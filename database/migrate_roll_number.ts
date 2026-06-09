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
    console.log('Adding roll_number column to students table...');
    await connection.query('ALTER TABLE students ADD COLUMN roll_number VARCHAR(50) AFTER photo_url;');
    console.log('✅ Column added successfully!');
  } catch (err: any) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('⚠️ Column roll_number already exists.');
    } else {
      console.error('❌ Error adding column:', err.message);
    }
  } finally {
    await connection.end();
  }
}

migrate();
