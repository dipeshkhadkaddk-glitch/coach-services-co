const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'coach_services_db';

// Internal pool reference — populated after initializeDatabase() runs
let _pool = null;

// Proxy: any property/method access is forwarded to the real pool at call time.
// This means routes can safely do `const { pool } = require('../config/db')`
// and pool.query() will always hit the live connection.
const pool = new Proxy({}, {
  get(_, prop) {
    if (!_pool) throw new Error('DB pool not ready. initializeDatabase() has not completed.');
    const val = _pool[prop];
    return typeof val === 'function' ? val.bind(_pool) : val;
  }
});

const initializeDatabase = async () => {
  const baseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  };
  
  if (process.env.DB_SSL === 'true') {
    baseConfig.ssl = { rejectUnauthorized: false };
  }

  // Step 1: Connect WITHOUT a database to CREATE it (Fail silently for cloud DBs that restrict this)
  const bootstrapConn = await mysql.createConnection(baseConfig);
  try {
    await bootstrapConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  } catch (err) {
    console.log(`[DB Warning] Could not CREATE DATABASE (common in cloud environments): ${err.message}`);
  }
  await bootstrapConn.end();

  // Step 2: Build real pool now the database exists
  _pool = mysql.createPool({
    ...baseConfig,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 10s timeout
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  const conn = await _pool.getConnection();
  try {
    // Users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        dob DATE,
        phone VARCHAR(20) NOT NULL,
        address TEXT,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','user') DEFAULT 'user',
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Vehicles
    await conn.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        seats INT NOT NULL,
        driver_name VARCHAR(150) NOT NULL,
        plate_number VARCHAR(30) NOT NULL UNIQUE,
        status ENUM('active','inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Routes
    await conn.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pickup_location VARCHAR(200) NOT NULL,
        dropoff_location VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        vehicle_id INT,
        status ENUM('active','inactive') DEFAULT 'active',
        is_closed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
      )
    `);

    // Events
    await conn.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        venue_name VARCHAR(200) NOT NULL,
        venue_address TEXT NOT NULL,
        event_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_closed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Bookings
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        vehicle_id INT,
        route_id INT,
        booking_type ENUM('individual','group') NOT NULL,
        passenger_count INT DEFAULT 1,
        status ENUM('pending','confirmed','cancelled') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
        FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
      )
    `);

    // Booking passengers
    await conn.query(`
      CREATE TABLE IF NOT EXISTS booking_passengers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        passenger_name VARCHAR(150) NOT NULL,
        passenger_phone VARCHAR(20),
        passenger_email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `);

    // Notifications
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        message TEXT NOT NULL,
        type ENUM('booking','profile','system') DEFAULT 'system',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Seed default admin
    const bcrypt = require('bcryptjs');
    const [admins] = await conn.query(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
    if (admins.length === 0) {
      const hash = await bcrypt.hash('Admin@1234', 10);
      await conn.query(`
        INSERT INTO users (full_name, dob, phone, address, email, password_hash, role, status)
        VALUES ('Administrator', '1990-01-01', '+61400000000', 'Brisbane, QLD', 'admin@coachservices.com', ?, 'admin', 'approved')
      `, [hash]);
      console.log('✅ Default admin created: admin@coachservices.com / Admin@1234');
    } else {
      console.log('ℹ️  Admin account already exists');
    }

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ DB Init Error:', err.message);
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = { pool, initializeDatabase };
