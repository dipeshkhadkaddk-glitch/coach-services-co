require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log("Connected to DB...");
    await db.query('ALTER TABLE booking_passengers ADD COLUMN passenger_email VARCHAR(100);');
    console.log("✅ Column passenger_email added successfully via manual connection!");
    db.end();
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ Column already exists!');
    } else {
      console.error('❌ Error:', e.message);
    }
  }
}
run();
