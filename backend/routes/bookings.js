const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');

// GET /api/bookings — admin: all bookings; user: own bookings
router.get('/', authMiddleware, async (req, res) => {
  const { type } = req.query;
  try {
    let query = `
      SELECT b.*, u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone,
             v.name AS vehicle_name, v.plate_number,
             r.pickup_location, r.dropoff_location, r.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN routes r ON b.route_id = r.id
    `;
    const params = [];
    const conditions = [];
    if (req.user.role !== 'admin') {
      conditions.push('b.user_id=?');
      params.push(req.user.id);
    }
    if (type) {
      conditions.push('b.booking_type=?');
      params.push(type);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY b.created_at DESC';
    const [rows] = await pool.query(query, params);

    // For each booking, attach passengers
    for (const booking of rows) {
      const [passengers] = await pool.query(
        'SELECT * FROM booking_passengers WHERE booking_id=?', [booking.id]
      );
      booking.passengers = passengers;
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/bookings/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.full_name AS user_name, u.email AS user_email, u.phone AS user_phone,
             v.name AS vehicle_name, v.plate_number,
             r.pickup_location, r.dropoff_location, r.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN routes r ON b.route_id = r.id
      WHERE b.id=?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = rows[0];
    const [passengers] = await pool.query('SELECT * FROM booking_passengers WHERE booking_id=?', [booking.id]);
    booking.passengers = passengers;
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bookings — user: create booking
router.post('/', authMiddleware, async (req, res) => {
  const { vehicle_id, route_id, booking_type, passenger_count, passengers, notes } = req.body;
  if (!vehicle_id || !route_id || !booking_type) {
    return res.status(400).json({ success: false, message: 'Vehicle, route and booking type are required' });
  }
  if (!['individual', 'group'].includes(booking_type)) {
    return res.status(400).json({ success: false, message: 'Booking type must be individual or group' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check vehicle capacity and LOCK the row
    const [vehicleRows] = await conn.query('SELECT seats FROM vehicles WHERE id=? FOR UPDATE', [vehicle_id]);
    if (vehicleRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    const vehicleSeats = vehicleRows[0].seats;

    // 2. Check if route is closed
    const [routeCheck] = await conn.query('SELECT is_closed FROM routes WHERE id=?', [route_id]);
    if (routeCheck.length > 0 && routeCheck[0].is_closed) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This route is currently closed for bookings' });
    }

    // 3. Calculate currently booked seats (confirmed + pending)
    const [bookedRows] = await conn.query(
      "SELECT SUM(passenger_count) as total_booked FROM bookings WHERE vehicle_id=? AND route_id=? AND status != 'cancelled'",
      [vehicle_id, route_id]
    );
    const alreadyBooked = parseInt(bookedRows[0].total_booked) || 0;
    const availableSeats = vehicleSeats - alreadyBooked;

    const count = parseInt(passenger_count) || 1;
    if (count > availableSeats) {
      await conn.rollback();
      const msg = availableSeats > 0 
        ? `Only ${availableSeats} seats remaining on this shuttle.` 
        : `This shuttle is fully booked.`;
      return res.status(400).json({ success: false, message: msg });
    }

    // 4. Create booking
    const [bookingResult] = await conn.query(
      'INSERT INTO bookings (user_id, vehicle_id, route_id, booking_type, passenger_count, notes) VALUES (?,?,?,?,?,?)',
      [req.user.id, vehicle_id, route_id, booking_type, count, notes || '']
    );
    const bookingId = bookingResult.insertId;

    // 5. Insert passengers
    if (passengers && Array.isArray(passengers)) {
      for (const p of passengers) {
        await conn.query(
          'INSERT INTO booking_passengers (booking_id, passenger_name, passenger_phone, passenger_email) VALUES (?,?,?,?)',
          [bookingId, p.name || '', p.phone || '', p.email || null]
        );
      }
    }

    // Commit transaction
    await conn.commit();

    // 6. Notify admin (post-transaction)
    const [admins] = await pool.query("SELECT id FROM users WHERE role='admin'");
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
        [admin.id, `New ${booking_type} booking #${bookingId} from ${req.user.name}`, 'booking']
      );
    }

    // Get route details for notification
    const [routeRows] = await pool.query('SELECT * FROM routes WHERE id=?', [route_id]);
    const route = routeRows[0];

    // Notify user via in-app notification
    const userMsg = `Your ${booking_type} booking #${bookingId} from ${route?.pickup_location} to ${route?.dropoff_location} is pending confirmation.`;
    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)', [req.user.id, userMsg, 'booking']);

    res.status(201).json({ success: true, message: 'Booking submitted successfully', id: bookingId });
  } catch (err) {
    if (conn) await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// PUT /api/bookings/:id/status — admin: confirm/cancel booking
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const [rows] = await pool.query('SELECT b.*, u.phone, u.id AS uid, r.pickup_location, r.dropoff_location FROM bookings b JOIN users u ON b.user_id=u.id LEFT JOIN routes r ON b.route_id=r.id WHERE b.id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = rows[0];
    await pool.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    const msg = `Your booking #${req.params.id} has been ${status}.`;
    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)', [booking.uid, msg, 'booking']);
    // SMS Notifications
    const [userInfo] = await pool.query('SELECT full_name, phone FROM users WHERE id=?', [booking.uid]);
    const mainBookerName = userInfo.length > 0 ? userInfo[0].full_name : 'Unknown User';
    const mainBookerPhone = userInfo.length > 0 ? userInfo[0].phone : null;
    
    if (status === 'confirmed') {
      const [passengers] = await pool.query('SELECT passenger_name, passenger_phone FROM booking_passengers WHERE booking_id=?', [req.params.id]);
      
      const smsMessage = `Coach Services Co: Your booking made by ${mainBookerName} for ${booking.pickup_location || 'Pickup'} to ${booking.dropoff_location || 'Dropoff'} is confirmed. Please be 15 minutes early of your scheduled time.`;
      
      // Track sent numbers to avoid duplicates
      const sentNumbers = new Set();
      
      // SMS to main booker — wrapped in its own try/catch so it never blocks others
      if (mainBookerPhone) {
        try {
          await sendSMS(mainBookerPhone, smsMessage);
          sentNumbers.add(mainBookerPhone);
        } catch (smsErr) {
          console.error(`[SMS ERROR] Failed for main booker (${mainBookerPhone}): ${smsErr.message}`);
        }
      }
      // SMS to each secondary passenger — individual try/catch per number
      for (const pax of passengers) {
        if (pax.passenger_phone && !sentNumbers.has(pax.passenger_phone)) {
          try {
            await sendSMS(pax.passenger_phone, smsMessage);
            sentNumbers.add(pax.passenger_phone);
          } catch (smsErr) {
            console.error(`[SMS ERROR] Failed for passenger ${pax.passenger_name} (${pax.passenger_phone}): ${smsErr.message}`);
          }
        }
      }
      console.log(`[SMS] Confirmation sent to ${sentNumbers.size} recipient(s) for booking #${req.params.id}`);
    } else if (status === 'cancelled') {
      const cancelMsg = `Coach Services Co: Your booking #${req.params.id} from ${booking.pickup_location || 'Pickup'} to ${booking.dropoff_location || 'Dropoff'} has been cancelled.`;
      const cancelledNumbers = new Set();
      // Notify main booker
      if (mainBookerPhone) {
        try {
          await sendSMS(mainBookerPhone, cancelMsg);
          cancelledNumbers.add(mainBookerPhone);
        } catch (smsErr) {
          console.error(`[SMS ERROR] Cancel SMS failed for main booker (${mainBookerPhone}): ${smsErr.message}`);
        }
      }
      // Also notify secondary passengers on cancellation
      const [cancelPassengers] = await pool.query('SELECT passenger_name, passenger_phone FROM booking_passengers WHERE booking_id=?', [req.params.id]);
      for (const pax of cancelPassengers) {
        if (pax.passenger_phone && !cancelledNumbers.has(pax.passenger_phone)) {
          try {
            await sendSMS(pax.passenger_phone, cancelMsg);
            cancelledNumbers.add(pax.passenger_phone);
          } catch (smsErr) {
            console.error(`[SMS ERROR] Cancel SMS failed for passenger ${pax.passenger_name} (${pax.passenger_phone}): ${smsErr.message}`);
          }
        }
      }
      console.log(`[SMS] Cancellation sent to ${cancelledNumbers.size} recipient(s) for booking #${req.params.id}`);
    }
    res.json({ success: true, message: `Booking ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/bookings/:id — admin: permanently delete booking
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM bookings WHERE id=?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
