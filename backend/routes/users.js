const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');

// GET /api/users — admin: get all users
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { search } = req.query;
  try {
    let query = "SELECT id, full_name, dob, phone, address, email, role, status, created_at FROM users WHERE role='user'";
    const params = [];
    if (search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/me — current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, full_name, dob, phone, address, email, role, status, created_at FROM users WHERE id=?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/users/pending — admin: get pending profile requests
router.get('/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name, dob, phone, address, email, status, created_at FROM users WHERE status='pending' AND role='user' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id/status — admin: approve/reject/deactivate
router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status, reason } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const user = rows[0];

    await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);

    // Send SMS Notification via Twilio
    let smsMessage = "";
    if (status === 'approved') {
      smsMessage = "Your Coach Services profile has been approved! You can now log in and book transport for the Olympics.";
    } else if (status === 'rejected') {
      smsMessage = `Your Coach Services profile application was rejected. Reason: ${reason || 'Incomplete information'}.`;
    }

    if (smsMessage && user.phone) {
      await sendSMS(user.phone, smsMessage);
    }

    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
