# 🛡️ Technical Feature Documentation — Coach Services Co.
**Project:** Brisbane Olympics 2032 Transport Management System
**Topic:** Core Logic & Execution Flow

---

## 1. Intelligent SMS Notification Engine
**Purpose:** Ensures phone numbers are correctly formatted for Twilio and sends alerts for profile events.

### 📜 Code Logic (`backend/utils/sms.js`):
```javascript
// Ensure the number is in E.164 format (+61 for Australia)
let formattedTo = String(to).replace(/[\s\-\(\)]/g, ''); 

if (formattedTo.startsWith('0')) {
  // Converts 04xxx to +614xxx
  formattedTo = '+61' + formattedTo.substring(1);
} else if (!formattedTo.startsWith('+')) {
  // Adds +61 if missing
  formattedTo = '+61' + formattedTo;
}
```

### ⚙️ How it executes:
1. When any part of the app calls `sendSMS(phone, message)`, this logic first "strips" spaces and dashes.
2. It detects if the number is in local format (starts with `0`).
3. It prepends the Australian country code (`+61`) so Twilio can route the message internationally.
4. Finally, it uses the Twilio Client to dispatch the message to the user's mobile device.

---

## 2. Booking Intelligence (Capacity Enforcement)
**Purpose:** Prevents a shuttle from being overbooked beyond its seat count.

### 📜 Code Logic (`backend/routes/bookings.js`):
```javascript
// Step 1: Get vehicle capacity
const [vehicleRows] = await pool.query('SELECT seats FROM vehicles WHERE id=?', [vehicle_id]);
const vehicle = vehicleRows[0];

// Step 2: Compare with requested count
const count = parseInt(passenger_count) || 1;
if (count > vehicle.seats) {
  return res.status(400).json({ success: false, message: `Vehicle only has ${vehicle.seats} seats` });
}
```

### ⚙️ How it executes:
1. When a user submits a booking, the server first queries the `vehicles` table for that specific shuttle's `seats` limit.
2. It then calculates the `passenger_count` (main booker + guest passengers).
3. If the count exceeds the seat limit, it immediately returns a `400 Bad Request` and stops the booking, protecting the driver from overcrowding.

---

## 3. Passenger Manifest Generation (Master List)
**Purpose:** Aggregates all separate bookings for a single route into one printable master list.

### 📜 Code Logic (`backend/routes/routes.js`):
```sql
SELECT 'Main' as type, b.id as booking_id, u.full_name as passenger_name, u.phone, u.full_name as main_booker
FROM bookings b 
JOIN users u ON b.user_id = u.id 
WHERE b.route_id=? AND b.status='confirmed'
UNION
SELECT 'Dependent' as type, b.id as booking_id, bp.passenger_name, bp.passenger_phone as phone, u.full_name as main_booker
FROM bookings b 
JOIN users u ON b.user_id = u.id 
JOIN booking_passengers bp ON b.id = bp.booking_id 
WHERE b.route_id=? AND b.status='confirmed'
```

### ⚙️ How it executes:
1. The `UNION` SQL query combines two different datasets:
   - **Part 1:** The primary accounts (Main Bookers) who made the booking.
   - **Part 2:** The extra people (Dependent Passengers) added to those bookings.
2. It filters only for bookings with a status of `'confirmed'`.
3. The result is a clean, alphabetical list of **every human being** scheduled to board the coach for that specific route, which the Admin can then print for the driver.

---

## 4. Route Lockdown Logic
**Purpose:** Allows admins to stop new bookings for a specific route without deleting the route from the system.

### 📜 Code Logic (`backend/routes/bookings.js`):
```javascript
const [routeCheck] = await pool.query('SELECT is_closed FROM routes WHERE id=?', [route_id]);
if (routeCheck.length > 0 && routeCheck[0].is_closed) {
  return res.status(400).json({ success: false, message: 'This route is currently closed for bookings' });
}
```

### ⚙️ How it executes:
1. In the `routes` table, every route has an `is_closed` boolean column.
2. Before any booking is allowed to be saved, the server checks if `is_closed` is `true`.
3. If the Route is locked, the booking process is aborted, and the user sees a "Route Closed" message in their dashboard.

---

## 5. Booking Confirmation Broadcast (SMS)
**Purpose:** Notifies every passenger in a group booking via SMS once the admin approves it.

### 📜 Code Logic (`backend/routes/bookings.js`):
```javascript
if (status === 'confirmed') {
  // 1. Notify Main Booker
  if (mainBookerPhone) await sendSMS(mainBookerPhone, smsMessage);
  
  // 2. Notify all dependent passengers
  for (const pax of passengers) {
    if (pax.passenger_phone) {
      await sendSMS(pax.passenger_phone, smsMessage);
    }
  }
}
```

### ⚙️ How it executes:
1. When an Admin changes a booking status to `'confirmed'`, the server enters this broadcast loop.
2. It first sends the confirmation SMS to the person who made the booking.
3. It then iterates through the `booking_passengers` table and sends an individual SMS to every phone number listed there, ensuring everyone in the group is informed.
