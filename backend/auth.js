const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

require('dotenv').config();

// POST /api/auth/register — submit profile request
router.post('/register', async (req, res) => {
  const { full_name, dob, phone, address, email, password } = req.body;
  if (!full_name || !phone || !email || !password) {
    return res.status(400).json({ success: false, message: 'Full name, phone, email and password are required' });
  }
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (full_name, dob, phone, address, email, password_hash, role, status) VALUES (?,?,?,?,?,?,?,?)',
      [full_name, dob || null, phone, address || '', email, hash, 'user', 'pending']
    );

    // Notify admin via In-App Notification
    const [admins] = await pool.query("SELECT id FROM users WHERE role='admin'");
    for (const admin of admins) {
      await pool.query(
        'INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)',
        [admin.id, `New profile request from ${full_name} (${email})`, 'profile']
      );
    }

    res.json({ success: true, message: 'Profile request submitted. Awaiting admin approval.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ success: false, message: 'Your account has been rejected. Contact admin.' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      token,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role, phone: user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
