const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

router.post('/register', async (req, res) => {
  const { full_name, phone, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (full_name, phone, email, password_hash, status) VALUES (?,?,?,?,?)',
      [full_name, phone, email, hash, 'pending']
    );
    res.json({ success: true, message: 'Profile request submitted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const user = rows[0];
    if (await bcrypt.compare(password, user.password_hash)) {
      if (user.status !== 'approved') return res.status(403).json({ success: false, message: 'Account not approved' });
      const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, process.env.JWT_SECRET);
      return res.json({ success: true, token, user });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
