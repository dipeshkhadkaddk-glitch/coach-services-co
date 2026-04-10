const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { sendSMS } = require('../utils/sms');

router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { search } = req.query;
  try {
    let query = "SELECT id, full_name, phone, email, status, created_at FROM users WHERE role='user'";
    if (search) {
      query += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const s = `%${search}%`;
      const [rows] = await pool.query(query, [s, s, s]);
      return res.json({ success: true, data: rows });
    }
    const [rows] = await pool.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  const { status, reason } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
    const user = rows[0];
    await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    let smsMessage = "";
    if (status === 'approved') {
      smsMessage = "Your Coach Services profile has been approved!";
    } else if (status === 'rejected') {
      smsMessage = `Your profile was rejected. Reason: ${reason || 'Incomplete info'}.`;
    }
    if (smsMessage && user.phone) await sendSMS(user.phone, smsMessage);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
