const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/routes — get all routes (optionally filter by pickup/dropoff)
router.get('/', authMiddleware, async (req, res) => {
  const { pickup, dropoff } = req.query;
  try {
    let query = `
      SELECT r.*, v.name AS vehicle_name, v.seats, v.driver_name, v.plate_number, v.status AS vehicle_status
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.status='active'
    `;
    const params = [];
    if (pickup) { query += ' AND r.pickup_location LIKE ?'; params.push(`%${pickup}%`); }
    if (dropoff) { query += ' AND r.dropoff_location LIKE ?'; params.push(`%${dropoff}%`); }
    query += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/routes/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*, v.name AS vehicle_name, v.seats, v.driver_name, v.plate_number
      FROM routes r LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id=?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Route not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/routes — admin: create route with price
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { pickup_location, dropoff_location, price, vehicle_id } = req.body;
  if (!pickup_location || !dropoff_location || price === undefined) {
    return res.status(400).json({ success: false, message: 'Pickup, dropoff and price are required' });
  }
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

// DELETE /api/routes/:id — admin
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM routes WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Route deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
