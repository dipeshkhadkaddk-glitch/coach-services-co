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

// POST /api/bookings — user: create booking
router.post('/', authMiddleware, async (req, res) => {
  const { vehicle_id, route_id, booking_type, passenger_count, passengers, notes } = req.body;
  if (!vehicle_id || !route_id || !booking_type) {
    return res.status(400).json({ success: false, message: 'Vehicle, route and booking type are required' });
  }
  try {
    // Check vehicle capacity
    const [vehicleRows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [vehicle_id]);
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const vehicle = vehicleRows[0];

    // Check if route is closed
    const [routeCheck] = await pool.query('SELECT is_closed FROM routes WHERE id=?', [route_id]);
    if (routeCheck.length > 0 && routeCheck[0].is_closed) {
      return res.status(400).json({ success: false, message: 'This route is currently closed for bookings' });
    }

    const count = parseInt(passenger_count) || 1;
    if (count > vehicle.seats) {
      return res.status(400).json({ success: false, message: `Vehicle only has ${vehicle.seats} seats` });
    }

    const [bookingResult] = await pool.query(
      'INSERT INTO bookings (user_id, vehicle_id, route_id, booking_type, passenger_count, notes) VALUES (?,?,?,?,?,?)',
      [req.user.id, vehicle_id, route_id, booking_type, count, notes || '']
    );
    const bookingId = bookingResult.insertId;

    if (passengers && Array.isArray(passengers)) {
      for (const p of passengers) {
        await pool.query(
          'INSERT INTO booking_passengers (booking_id, passenger_name, passenger_phone, passenger_email) VALUES (?,?,?,?)',
          [bookingId, p.name || '', p.phone || '', p.email || null]
        );
      }
    }

    res.status(201).json({ success: true, message: 'Booking submitted successfully', id: bookingId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bookings/:id/status — admin: confirm
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    const [rows] = await pool.query('SELECT b.*, u.phone, u.id AS uid, r.pickup_location, r.dropoff_location FROM bookings b JOIN users u ON b.user_id=u.id LEFT JOIN routes r ON b.route_id=r.id WHERE b.id=?', [req.params.id]);
    const booking = rows[0];
    await pool.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    
    // SMS Notifications
    const [userInfo] = await pool.query('SELECT full_name, phone FROM users WHERE id=?', [booking.uid]);
    const mainBookerName = userInfo[0]?.full_name || 'Admin';
    const mainBookerPhone = userInfo[0]?.phone;
    
    if (status === 'confirmed') {
      const [passengers] = await pool.query('SELECT passenger_phone FROM booking_passengers WHERE booking_id=?', [req.params.id]);
      const smsMessage = `Coach Services Co: Booking for ${booking.pickup_location} to ${booking.dropoff_location} is confirmed! Please be 15 mins early.`;
      
      if (mainBookerPhone) await sendSMS(mainBookerPhone, smsMessage);
      for (const pax of passengers) {
        if (pax.passenger_phone) await sendSMS(pax.passenger_phone, smsMessage);
      }
    }
    res.json({ success: true, message: `Booking ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
