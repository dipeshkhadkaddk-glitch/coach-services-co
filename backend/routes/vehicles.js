const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/vehicles — get all vehicles
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/vehicles/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/vehicles — admin: create vehicle
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, seats, driver_name, plate_number } = req.body;
  if (!name || !seats || !driver_name || !plate_number) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO vehicles (name, seats, driver_name, plate_number) VALUES (?,?,?,?)',
      [name, seats, driver_name, plate_number]
    );
    res.status(201).json({ success: true, message: 'Vehicle created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Plate number already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/vehicles/:id — admin: update vehicle
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, seats, driver_name, plate_number, status } = req.body;
  try {
    await pool.query(
      'UPDATE vehicles SET name=?, seats=?, driver_name=?, plate_number=?, status=? WHERE id=?',
      [name, seats, driver_name, plate_number, status || 'active', req.params.id]
    );
    res.json({ success: true, message: 'Vehicle updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/vehicles/:id — admin: delete vehicle
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM vehicles WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Vehicle deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
