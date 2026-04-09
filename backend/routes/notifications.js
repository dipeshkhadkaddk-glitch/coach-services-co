const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications — get user notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/:id/read — mark as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read=1 WHERE user_id=?', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
