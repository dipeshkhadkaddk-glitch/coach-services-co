# 🚌 Coach Services Co. — Brisbane Olympics 2032

## Overview
This is the complete full-stack transport booking app for Brisbane Olympics 2032 coach services.

---

## Prerequisites

You need to install the following before running:

### 1. Install Node.js
👉 Download from: **https://nodejs.org** (choose LTS version 20.x)
- During install, check **"Add to PATH"**
- After install, verify: open a new terminal and run `node --version`

### 2. Install MySQL
👉 Download from: **https://dev.mysql.com/downloads/mysql/**
- Or use **XAMPP**: https://www.apachefriends.org (includes MySQL)
- Or use **MySQL Workbench**: https://dev.mysql.com/downloads/workbench/

---

## Project Structure

```
coach-services-co/
├── backend/           ← Node.js + Express API server
│   ├── server.js      ← Main entry point
│   ├── .env           ← ⚠️ Configure your DB credentials here
│   ├── config/db.js   ← MySQL connection & auto-setup
│   ├── routes/        ← All API endpoints
│   ├── middleware/    ← JWT auth
│   └── utils/sms.js   ← Twilio SMS (optional)
├── frontend/          ← Static HTML/CSS/JS (served by backend)
│   ├── index.html     ← Login / Register page
│   ├── user/          ← User pages
│   └── admin/         ← Admin pages
└── database/
    └── schema.sql     ← MySQL schema (auto-runs on server start)
```

---

## Setup Steps

### Step 1 — Configure Database

Edit `backend/.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=coach_services_db
JWT_SECRET=coach_services_brisbane_olympics_2032_secret_key
PORT=5000
```

### Step 2 — (Optional) Import Database Manually
If you prefer to import manually in MySQL Workbench:
```sql
-- Open MySQL Workbench, connect, then run:
source C:/path/to/coach-services-co/database/schema.sql
```
Otherwise the server will **auto-create all tables on first start**.

### Step 3 — Install Backend Dependencies
Open terminal in the `backend/` folder:
```bash
npm install
```

### Step 4 — Start the Server
```bash
npm start
```
Or for auto-restart on file changes:
```bash
npm run dev
```

### Step 5 — Open the App
Open your browser and go to:
**http://localhost:5000**

---

## Default Credentials

| Role  | Email                        | Password   |
|-------|------------------------------|------------|
| Admin | admin@coachservices.com      | Admin@1234 |

> The admin account is **auto-created** on first server startup if it doesn't exist.

---

## App Pages

### User Pages
| Page | URL |
|------|-----|
| Login / Register | `/` |
| User Dashboard | `/user/dashboard.html` |
| My Profile | `/user/profile.html` |
| Events | `/user/events.html` |
| Search Vehicles | `/user/search.html` |
| Book a Ride | `/user/book.html` |

### Admin Pages
| Page | URL |
|------|-----|
| Admin Dashboard | `/admin/dashboard.html` |
| User Management | `/admin/users.html` |
| Vehicle Management | `/admin/vehicles.html` |
| Routes & Pricing | `/admin/routes.html` |
| Events Management | `/admin/events.html` |
| Bookings | `/admin/bookings.html` |

---

## Features Implemented

### User Features
- ✅ Register / Request Profile (US1, US8, US9)
- ✅ Receive notification when approved (US2)
- ✅ Login with JWT (US10)
- ✅ View profile (US11)
- ✅ Update profile — name, phone, address only; email locked (US12)
- ✅ Search vehicles by location & route (US3, US4, US13)
- ✅ View event venues and times (US14, US15)
- ✅ Individual booking — name + phone (US5, US6, US7)
- ✅ Group booking — number of passengers, names, phones (US5, US8, US9, US10)

### Admin Features
- ✅ Admin dashboard with live stats (US1)
- ✅ View & manage user profiles, search, approve/reject/remove (US2)
- ✅ Profile approval requests with notifications (US11, US12)
- ✅ Create & update vehicle profiles (US3, US4)
- ✅ Set fixed price per route (US5)
- ✅ Add and manage event venues (US6)
- ✅ Add and manage event times (US7)
- ✅ Receive booking notifications (US13)
- ✅ Filter bookings by type: individual / group (US14)
- ✅ Confirm or cancel bookings with SMS to user

### Notifications
- ✅ In-app notifications (bell icon)
- ✅ SMS via Twilio (configure in .env to enable)

---

## SMS Notifications (Optional)

To enable SMS:
1. Sign up at https://www.twilio.com (free trial available)
2. Get your Account SID, Auth Token, and a Twilio phone number
3. Add to `backend/.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```
SMS is sent when:
- Admin approves or rejects a user profile
- Admin confirms or cancels a booking
- User submits a new booking

---

## Tech Stack
- **Frontend:** HTML5, Vanilla CSS, Vanilla JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MySQL (mysql2 driver)
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **SMS:** Twilio (optional)
