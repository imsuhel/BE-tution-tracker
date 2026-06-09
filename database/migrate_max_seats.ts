import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '00000000',
    database: process.env.DB_NAME || 'academy_management'
  });

  try {
    console.log('Adding max_seats column to batches table...');
    await connection.query('ALTER TABLE batches ADD COLUMN max_seats INT DEFAULT 0 AFTER status;');
    console.log('✅ Column added successfully!');
  } catch (err: any) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('⚠️ Column max_seats already exists.');
    } else {
      console.error('❌ Error adding column:', err.message);
    }
  } finally {
    await connection.end();
  }
}

migrate();
