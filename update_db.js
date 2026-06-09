const mysql = require('mysql2/promise');
require('dotenv').config();
async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'tuition_tracker'
  });
  try {
    await connection.query('ALTER TABLE fees DROP COLUMN due_date');
    console.log('Successfully dropped due_date column');
  } catch (err) {
    console.error('Error dropping due_date:', err.message);
  } finally {
    await connection.end();
  }
}
run();
