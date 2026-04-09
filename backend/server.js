const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { initializeDatabase } = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const vehicleRoutes = require('./routes/vehicles');
const routeRoutes = require('./routes/routes');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);

// Admin dashboard stats
app.get('/api/dashboard/stats', async (req, res) => {
  const { pool } = require('./config/db');
  try {
    const [[{ total_users }]] = await pool.query('SELECT COUNT(*) AS total_users FROM users WHERE role="user" AND status="approved"');
    const [[{ pending_users }]] = await pool.query('SELECT COUNT(*) AS pending_users FROM users WHERE role="user" AND status="pending"');
    const [[{ total_vehicles }]] = await pool.query('SELECT COUNT(*) AS total_vehicles FROM vehicles WHERE status="active"');
    const [[{ total_routes }]] = await pool.query('SELECT COUNT(*) AS total_routes FROM routes WHERE status="active"');
    const [[{ total_bookings }]] = await pool.query('SELECT COUNT(*) AS total_bookings FROM bookings');
    const [[{ pending_bookings }]] = await pool.query('SELECT COUNT(*) AS pending_bookings FROM bookings WHERE status="pending"');
    const [[{ total_events }]] = await pool.query('SELECT COUNT(*) AS total_events FROM events');
    const [recent_bookings] = await pool.query(`
      SELECT b.id, b.booking_type, b.status, b.created_at, u.full_name, r.pickup_location, r.dropoff_location
      FROM bookings b LEFT JOIN users u ON b.user_id=u.id LEFT JOIN routes r ON b.route_id=r.id
      ORDER BY b.created_at DESC LIMIT 5
    `);
    res.json({
      success: true,
      data: { total_users, pending_users, total_vehicles, total_routes, total_bookings, pending_bookings, total_events, recent_bookings }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SPA fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
});

// Start server
const startServer = async () => {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`🚌 Coach Services Co. server running at http://localhost:${PORT}`);
    console.log(`📊 Admin Login: admin@coachservices.com / Admin@1234`);
  });
};

startServer();
