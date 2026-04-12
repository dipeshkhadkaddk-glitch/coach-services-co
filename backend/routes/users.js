const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { emailProfileApproved, emailProfileRejected } = require('../utils/email');

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

// PUT /api/users/me — update own profile (name, address, phone only)
router.put('/me', authMiddleware, async (req, res) => {
  const { full_name, address, phone } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ success: false, message: 'Full name and phone are required' });
  }
  try {
    await pool.query(
      'UPDATE users SET full_name=?, address=?, phone=? WHERE id=?',
      [full_name, address || '', phone, req.user.id]
    );
    res.json({ success: true, message: 'Profile updated successfully' });
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
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const user = rows[0];
    await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id]);
    // Notify user
    const msg = status === 'approved'
      ? 'Your profile has been approved! You can now log in and book rides.'
      : `Your profile request has been ${status}.`;
    await pool.query('INSERT INTO notifications (user_id, message, type) VALUES (?,?,?)', [user.id, msg, 'profile']);
    // Email notification
    if (status === 'approved') {
      await emailProfileApproved(user.full_name, user.email);
    } else if (status === 'rejected') {
      await emailProfileRejected(user.full_name, user.email);
    }
    res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/:id — admin: remove user
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=? AND role='user'", [req.params.id]);
    res.json({ success: true, message: 'User removed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
