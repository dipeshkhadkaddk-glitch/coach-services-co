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
    const [usersRes] = await pool.query("SELECT COUNT(*) AS total_users FROM users WHERE role='user' AND status='approved'");
    const total_users = usersRes[0].total_users;

    const [pendingRes] = await pool.query("SELECT COUNT(*) AS pending_users FROM users WHERE role='user' AND status='pending'");
    const pending_users = pendingRes[0].pending_users;

    const [vehiclesRes] = await pool.query("SELECT COUNT(*) AS total_vehicles FROM vehicles WHERE status='active'");
    const total_vehicles = vehiclesRes[0].total_vehicles;

    const [routesRes] = await pool.query("SELECT COUNT(*) AS total_routes FROM routes WHERE status='active'");
    const total_routes = routesRes[0].total_routes;

    const [bookingsRes] = await pool.query("SELECT COUNT(*) AS total_bookings FROM bookings");
    const total_bookings = bookingsRes[0].total_bookings;

    const [pbRes] = await pool.query("SELECT COUNT(*) AS pending_bookings FROM bookings WHERE status='pending'");
    const pending_bookings = pbRes[0].pending_bookings;

    const [eventsRes] = await pool.query('SELECT COUNT(*) AS total_events FROM events');
    const total_events = eventsRes[0].total_events;
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

// SPA fallback: serve index.html for non-API, non-static routes
// express.static above already handles real .html files (manifest.html, etc.)
// This fallback only applies to routes that didn't match any static file
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API endpoint not found' });
  }
  // If the path looks like a direct file request (has an extension), let express handle 404
  if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }
  // For clean URL routes (no extension), serve index.html as SPA fallback
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
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
