const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/routes — get all routes
router.get('/', authMiddleware, async (req, res) => {
  const { pickup, dropoff } = req.query;
  try {
    let query = `
      SELECT r.*, v.name AS vehicle_name, v.seats, v.driver_name, v.plate_number
      FROM routes r LEFT JOIN vehicles v ON r.vehicle_id = v.id
    `;
    const params = [];
    if (pickup) { query += ' WHERE r.pickup_location LIKE ?'; params.push(`%${pickup}%`); }
    if (dropoff) { query += (pickup ? ' AND' : ' WHERE') + ' r.dropoff_location LIKE ?'; params.push(`%${dropoff}%`); }
    query += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/routes — admin: create route
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { pickup_location, dropoff_location, price, vehicle_id } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO routes (pickup_location, dropoff_location, price, vehicle_id) VALUES (?,?,?,?)',
      [pickup_location, dropoff_location, price, vehicle_id || null]
    );
    res.status(201).json({ success: true, message: 'Route created', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/routes/:id — admin: update route
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { pickup_location, dropoff_location, price, vehicle_id, status } = req.body;
  try {
    await pool.query(
      'UPDATE routes SET pickup_location=?, dropoff_location=?, price=?, vehicle_id=?, status=? WHERE id=?',
      [pickup_location, dropoff_location, price, vehicle_id || null, status || 'active', req.params.id]
    );
    res.json({ success: true, message: 'Route updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/routes/:id — admin: delete route
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM routes WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/routes/:id/toggle-close — admin: toggle open/closed for bookings
router.put('/:id/toggle-close', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_closed FROM routes WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Route not found' });
    const newStatus = !rows[0].is_closed;
    await pool.query('UPDATE routes SET is_closed=? WHERE id=?', [newStatus, req.params.id]);
    res.json({ success: true, is_closed: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/routes/:id/passengers — admin: get passenger manifest
router.get('/:id/passengers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.passenger_name, p.passenger_phone, p.passenger_email, b.id AS booking_id, u.full_name AS booker_name
      FROM booking_passengers p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE b.route_id = ? AND b.status = 'confirmed'
    `, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
