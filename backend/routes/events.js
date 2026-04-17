const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/events — all events
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM events ORDER BY event_date ASC, start_time ASC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM events WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Event not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/events — admin: add event
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, venue_name, venue_address, event_date, start_time, end_time } = req.body;
  if (!name || !venue_name || !venue_address || !event_date || !start_time || !end_time) {
    return res.status(400).json({ success: false, message: 'All fields are required' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ success: false, message: 'Start time must be before end time' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO events (name, venue_name, venue_address, event_date, start_time, end_time) VALUES (?,?,?,?,?,?)',
      [name, venue_name, venue_address, event_date, start_time, end_time]
    );
    res.status(201).json({ success: true, message: 'Event added successfully', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/events/:id — admin: update event
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, venue_name, venue_address, event_date, start_time, end_time } = req.body;
  if (start_time >= end_time) {
    return res.status(400).json({ success: false, message: 'Start time must be before end time' });
  }
  try {
    await pool.query(
      'UPDATE events SET name=?, venue_name=?, venue_address=?, event_date=?, start_time=?, end_time=? WHERE id=?',
      [name, venue_name, venue_address, event_date, start_time, end_time, req.params.id]
    );
    res.json({ success: true, message: 'Event updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/:id — admin
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM events WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
