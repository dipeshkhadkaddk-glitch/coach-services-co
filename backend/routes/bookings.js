const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { emailBookingConfirmed, emailBookingCancelled, sendEmailRaw } = require('../utils/email');

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
  try {
    // Check vehicle capacity
    const [vehicleRows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [vehicle_id]);
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const vehicle = vehicleRows[0];

    const count = parseInt(passenger_count) || 1;
    if (count > vehicle.seats) {
      return res.status(400).json({ success: false, message: `Vehicle only has ${vehicle.seats} seats` });
    }

    const [bookingResult] = await pool.query(
      'INSERT INTO bookings (user_id, vehicle_id, route_id, booking_type, passenger_count, notes) VALUES (?,?,?,?,?,?)',
      [req.user.id, vehicle_id, route_id, booking_type, count, notes || '']
    );
    const bookingId = bookingResult.insertId;

    // Insert passengers
    if (passengers && Array.isArray(passengers)) {
      for (const p of passengers) {
        await pool.query(
          'INSERT INTO booking_passengers (booking_id, passenger_name, passenger_phone, passenger_email) VALUES (?,?,?,?)',
          [bookingId, p.name || '', p.phone || '', p.email || null]
        );
      }
    }

    // Notify admin
    const [admins] = await pool.query('SELECT id FROM users WHERE role="admin"');
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
        [admin.id, `New ${booking_type} booking #${bookingId} from ${req.user.name}`, 'booking']
      );
    }

    // Get route details for SMS
    const [routeRows] = await pool.query('SELECT * FROM routes WHERE id=?', [route_id]);
    const route = routeRows[0];

    // Notify user via in-app notification
    const userMsg = `Your ${booking_type} booking #${bookingId} from ${route?.pickup_location} to ${route?.dropoff_location} is pending confirmation.`;
    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)', [req.user.id, userMsg, 'booking']);

    // Email to main user
    const [userRows] = await pool.query('SELECT email FROM users WHERE id=?', [req.user.id]);
    const mainUserEmail = userRows.length > 0 ? userRows[0].email : null;
    if (mainUserEmail) {
      await sendEmailRaw(mainUserEmail, "Booking Pending Confirmation", `Coach Services Co: ${userMsg}`);
    }

    // Email to all other passengers
    if (passengers && Array.isArray(passengers)) {
      for (const p of passengers) {
        if (p.email && p.email !== mainUserEmail) {
          const paxMsg = `Hi ${p.name}, you have been included in a ${booking_type} booking #${bookingId} from ${route?.pickup_location} to ${route?.dropoff_location}. It is currently pending confirmation.`;
          await sendEmailRaw(p.email, "Booking Pending Confirmation", `Coach Services Co: ${paxMsg}`);
        }
      }
    }

    res.status(201).json({ success: true, message: 'Booking submitted successfully', id: bookingId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    // Email to main user and all passengers
    const route2 = `${booking.pickup_location || 'Pickup'} → ${booking.dropoff_location || 'Dropoff'}`;
    const [userInfo] = await pool.query('SELECT full_name, email FROM users WHERE id=?', [booking.uid]);
    const [passengers] = await pool.query('SELECT passenger_name, passenger_email FROM booking_passengers WHERE booking_id=?', [req.params.id]);

    if (status === 'confirmed') {
      if (userInfo.length > 0 && userInfo[0].email) {
        await emailBookingConfirmed(userInfo[0].full_name, userInfo[0].email, req.params.id, route2);
      }
      for (const pax of passengers) {
        if (pax.passenger_email && pax.passenger_email !== userInfo[0]?.email) {
          await emailBookingConfirmed(pax.passenger_name, pax.passenger_email, req.params.id, route2);
        }
      }
    } else if (status === 'cancelled') {
      if (userInfo.length > 0 && userInfo[0].email) {
        await emailBookingCancelled(userInfo[0].full_name, userInfo[0].email, req.params.id);
      }
      for (const pax of passengers) {
        if (pax.passenger_email && pax.passenger_email !== userInfo[0]?.email) {
          await emailBookingCancelled(pax.passenger_name, pax.passenger_email, req.params.id);
        }
      }
    }
    res.json({ success: true, message: `Booking ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
