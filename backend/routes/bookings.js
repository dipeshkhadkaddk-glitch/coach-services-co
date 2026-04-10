const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');

// GET /api/bookings
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT b.*, u.full_name AS user_name, u.phone AS user_phone,
             v.name AS vehicle_name, r.pickup_location, r.dropoff_location
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN routes r ON b.route_id = r.id
    `;
    const params = [];
    if (req.user.role !== 'admin') {
      query += ' WHERE b.user_id=?';
      params.push(req.user.id);
    }
    query += ' ORDER BY b.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bookings
router.post('/', authMiddleware, async (req, res) => {
  const { route_id, vehicle_id, booking_type, passenger_count, passengers } = req.body;
  const [routeRows] = await pool.query('SELECT is_closed FROM routes WHERE id=?', [route_id]);
  if (routeRows.length > 0 && routeRows[0].is_closed) {
    return res.status(403).json({ success: false, message: 'This route is currently closed for bookings.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO bookings (user_id, route_id, vehicle_id, booking_type, passenger_count, status) VALUES (?,?,?,?,?,?)',
      [req.user.id, route_id, vehicle_id, booking_type, passenger_count, 'pending']
    );
    const bookingId = result.insertId;
    if (passengers && Array.isArray(passengers)) {
      for (const p of passengers) {
        await pool.query(
          'INSERT INTO booking_passengers (booking_id, passenger_name, passenger_phone) VALUES (?,?,?)',
          [bookingId, p.name, p.phone]
        );
      }
    }
    res.status(201).json({ success: true, message: 'Booking created', id: bookingId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bookings/:id/status
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    if (status === 'confirmed') {
      const [routeData] = await pool.query('SELECT r.pickup_location, r.dropoff_location FROM bookings b JOIN routes r ON b.route_id=r.id WHERE b.id=?', [req.params.id]);
      const [passengers] = await pool.query('SELECT passenger_phone FROM booking_passengers WHERE booking_id=?', [req.params.id]);
      const [mainUser] = await pool.query('SELECT u.phone FROM bookings b JOIN users u ON b.user_id=u.id WHERE b.id=?', [req.params.id]);
      const smsText = `Your booking for ${routeData[0].pickup_location} to ${routeData[0].dropoff_location} is confirmed. Please be 15 mins early.`;
      if (mainUser[0]?.phone) await sendSMS(mainUser[0].phone, smsText);
      for (const p of passengers) {
        if (p.passenger_phone) await sendSMS(p.passenger_phone, smsText);
      }
    }
    res.json({ success: true, message: 'Booking status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
