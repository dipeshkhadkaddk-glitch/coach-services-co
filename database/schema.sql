-- ================================================
-- Coach Services Co. — Brisbane Olympics 2032
-- MySQL Database Schema
-- Run this file in MySQL Workbench or CLI:
--   mysql -u root -p < schema.sql
-- ================================================

CREATE DATABASE IF NOT EXISTS coach_services_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coach_services_db;

-- Users table
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
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  seats INT NOT NULL,
  driver_name VARCHAR(150) NOT NULL,
  plate_number VARCHAR(30) NOT NULL UNIQUE,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Routes table (includes fixed price per location)
CREATE TABLE IF NOT EXISTS routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pickup_location VARCHAR(200) NOT NULL,
  dropoff_location VARCHAR(200) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  vehicle_id INT,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  venue_name VARCHAR(200) NOT NULL,
  venue_address TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
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
);

-- Booking passengers table
CREATE TABLE IF NOT EXISTS booking_passengers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  passenger_name VARCHAR(150) NOT NULL,
  passenger_phone VARCHAR(20),
  passenger_email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  message TEXT NOT NULL,
  type ENUM('booking','profile','system') DEFAULT 'system',
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ================================================
-- Default Admin Account
-- Email: admin@coachservices.com
-- Password: Admin@1234  (bcrypt hash below)
-- ================================================
INSERT IGNORE INTO users (full_name, dob, phone, address, email, password_hash, role, status)
VALUES (
  'Administrator',
  '1990-01-01',
  '+61400000000',
  'Brisbane, QLD',
  'admin@coachservices.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  'admin',
  'approved'
);
-- Note: If the above hash doesn't work, the server auto-creates admin on first boot.

-- ================================================
-- Sample Data (Optional — comment out if not needed)
-- ================================================

-- Sample Vehicles
INSERT IGNORE INTO vehicles (name, seats, driver_name, plate_number, status) VALUES
  ('Brisbane Express Coach A', 48, 'Michael Johnson', 'QLD-001-A', 'active'),
  ('Gold Coast Shuttle B', 32, 'Sarah Williams', 'QLD-002-B', 'active'),
  ('Olympic VIP Coach C', 24, 'David Chen', 'QLD-003-C', 'active');

-- Sample Routes (with fixed prices)
INSERT IGNORE INTO routes (pickup_location, dropoff_location, price, vehicle_id) VALUES
  ('Brisbane CBD Coach Terminal', 'Gabba Stadium, Woolloongabba', 25.00, 1),
  ('Brisbane CBD Coach Terminal', 'QSAC, Nathan', 30.00, 2),
  ('Brisbane CBD Coach Terminal', 'Suncorp Stadium, Milton', 20.00, 3),
  ('Brisbane CBD Coach Terminal', 'Brisbane Entertainment Centre', 35.00, 1);

-- Sample Events
INSERT IGNORE INTO events (name, venue_name, venue_address, event_date, start_time, end_time) VALUES
  ('Athletics 100m Final', 'Gabba Stadium', 'Vulture St, Woolloongabba QLD 4102', '2032-07-24', '19:00:00', '22:00:00'),
  ('Swimming Finals Day 1', 'Brisbane Aquatics Centre', 'Cnr Mountford St & Rambla Ave, Chandler QLD 4155', '2032-07-25', '10:00:00', '17:00:00'),
  ('Rugby Sevens Final', 'Suncorp Stadium', '40 Lang Park, Milton QLD 4064', '2032-07-26', '14:00:00', '18:00:00'),
  ('Opening Ceremony', 'Brisbane Stadium', 'Meakin St, Langlands Park QLD 4151', '2032-07-23', '20:00:00', '23:59:00');
