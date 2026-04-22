const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/routes — get all routes (optionally filter by pickup/dropoff)
router.get('/', authMiddleware, async (req, res) => {
  const { pickup, dropoff } = req.query;
  try {
    let query = `
      SELECT r.*, v.name AS vehicle_name, v.seats, v.driver_name, v.plate_number, v.status AS vehicle_status,
             (SELECT COUNT(*) FROM bookings b WHERE b.route_id = r.id AND b.status = 'confirmed') AS confirmed_bookings,
             (SELECT SUM(passenger_count) FROM bookings b WHERE b.route_id = r.id AND b.status = 'confirmed') AS confirmed_passengers
      FROM routes r
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.status='active'
    `;
    const params = [];
    if (pickup) { query += ' AND r.pickup_location LIKE ?'; params.push(`%${pickup}%`); }
    if (dropoff) { query += ' AND r.dropoff_location LIKE ?'; params.push(`%${dropoff}%`); }
    query += ' ORDER BY r.created_at DESC';
    
    const [rows] = await pool.query({
      sql: query,
      values: params,
      timeout: 5000 
    });
    
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
    // Duplicate route prevention
    const p = pickup_location.trim();
    const d = dropoff_location.trim();
    console.log(`[DEBUG] POST /api/routes — checking for: "${p}" -> "${d}"`);

    const [existing] = await pool.query(
      'SELECT id FROM routes WHERE pickup_location=? AND dropoff_location=? AND status=\'active\'',
      [p, d]
    );

    console.log(`[DEBUG] Found ${existing.length} existing active route(s).`);

    if (existing.length > 0) {
      console.log(`[DEBUG] Duplicate blocked: ID ${existing[0].id}`);
      return res.status(409).json({ success: false, message: `A route from "${p}" to "${d}" already exists.` });
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
    }
    const [result] = await pool.query(
      'INSERT INTO routes (pickup_location, dropoff_location, price, vehicle_id) VALUES (?,?,?,?)',
      [pickup_location.trim(), dropoff_location.trim(), parsedPrice, vehicle_id || null]
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
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a valid positive number' });
    }
    // Check for duplicate route (excluding the current route being edited)
    if (pickup_location && dropoff_location) {
      const [dupe] = await pool.query(
        'SELECT id FROM routes WHERE pickup_location=? AND dropoff_location=? AND id != ? AND status=\'active\'',
        [pickup_location.trim(), dropoff_location.trim(), req.params.id]
      );
      if (dupe.length > 0) {
        return res.status(409).json({ success: false, message: `Another active route from "${pickup_location}" to "${dropoff_location}" already exists.` });
      }
    }
    await pool.query(
      'UPDATE routes SET pickup_location=?, dropoff_location=?, price=?, vehicle_id=?, status=? WHERE id=?',
      [pickup_location, dropoff_location, parsedPrice, vehicle_id || null, status || 'active', req.params.id]
    );
    res.json({ success: true, message: 'Route updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/routes/:id/toggle-close - admin: toggle route open/close status
router.put('/:id/toggle-close', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT is_closed FROM routes WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Route not found' });
    const isClosed = !rows[0].is_closed;
    await pool.query('UPDATE routes SET is_closed=? WHERE id=?', [isClosed, req.params.id]);
    res.json({ success: true, message: `Route ${isClosed ? 'closed' : 'opened'} successfully`, is_closed: isClosed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/routes/:id/passengers - admin: get passenger manifest for a route
router.get('/:id/passengers', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // 1. Get all confirmed bookings for this route
    const [bookings] = await pool.query(`
      SELECT b.id, b.user_id, b.booking_type, b.passenger_count, u.full_name as main_booker, u.phone as booker_phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.route_id = ? AND b.status = 'confirmed'
    `, [req.params.id]);

    const manifest = [];

    // 2. For each booking, fetch extra passengers
    for (const b of bookings) {
      const [passengers] = await pool.query(
        'SELECT passenger_name, passenger_phone, passenger_email FROM booking_passengers WHERE booking_id = ?',
        [b.id]
      );
      
      manifest.push({
        booking_id: b.id,
        booking_type: b.booking_type,
        passenger_count: b.passenger_count,
        main_booker: b.main_booker,
        booker_phone: b.booker_phone,
        passengers: passengers
      });
    }

    res.json({ success: true, data: manifest });
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
