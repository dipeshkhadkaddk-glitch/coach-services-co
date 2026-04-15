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

// GET /api/bookings/:id/manifest
router.get('/:id/manifest', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.full_name AS main_passenger_name, u.phone AS main_passenger_phone, u.email AS main_passenger_email,
             v.name AS vehicle_name, v.plate_number, v.driver_name,
             r.pickup_location, r.dropoff_location, r.price
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN routes r ON b.route_id = r.id
      WHERE b.id=?
    `, [req.params.id]);
    
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = rows[0];
    
    const [passengers] = await pool.query(
      'SELECT passenger_name, passenger_phone, passenger_email FROM booking_passengers WHERE booking_id=?', 
      [booking.id]
    );
    
    const manifest = {
      booking_id: booking.id,
      vehicle: { name: booking.vehicle_name, plate: booking.plate_number, driver: booking.driver_name },
      route: { from: booking.pickup_location, to: booking.dropoff_location },
      passengers: [
        { name: booking.main_passenger_name, phone: booking.main_passenger_phone, email: booking.main_passenger_email, role: 'Main Booker' },
        ...passengers.map(p => ({ name: p.passenger_name, phone: p.passenger_phone, email: p.passenger_email, role: 'Group Member' }))
      ]
    };
    
    res.json({ success: true, data: manifest });
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
  try {
    const [vehicleRows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [vehicle_id]);
    if (vehicleRows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const vehicle = vehicleRows[0];

    const count = parseInt(passenger_count) || 1;

    // Fixed capacity check using single quotes
    const [occupiedRows] = await pool.query(
      'SELECT SUM(passenger_count) AS occupied FROM bookings WHERE vehicle_id = ? AND route_id = ? AND status = \'confirmed\'',
      [vehicle_id, route_id]
    );
    const occupied = occupiedRows[0].occupied || 0;
    const remaining = vehicle.seats - occupied;

    if (count > remaining) {
      return res.status(400).json({ 
        success: false, 
        message: `Overbooked! Only ${remaining} seats remaining in this vehicle.` 
      });
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

// PUT /api/bookings/:id/status
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'cancelled', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const [rows] = await pool.query('SELECT b.*, u.id AS uid FROM bookings b JOIN users u ON b.user_id=u.id WHERE b.id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    await pool.query('UPDATE bookings SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: `Booking ${status} successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
