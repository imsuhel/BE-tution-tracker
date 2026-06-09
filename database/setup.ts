import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runSetup() {
  // Step 1: Connect without specifying database to create it if needed
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '00000000',
    multipleStatements: true,
  });

  console.log('✅  Connected to MySQL server.');

  // Step 2: Read the schema SQL file
  const schemaPath = path.resolve(__dirname, './schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Step 3: Execute the schema SQL (split by ; to handle statements one by one)
  // Use raw multi-statement mode for convenience
  try {
    console.log('⏳  Running schema.sql...');
    await connection.query(schemaSql);
    console.log('✅  Database schema created and seed data inserted successfully!');
    console.log('');
    console.log('📦  Database: academy_management');
    console.log('📋  Tables created: users, centers, courses, course_modules, teachers, batches,');
    console.log('                   students, batch_enrollments, attendance, tests, test_results,');
    console.log('                   fees, parent_reports');
    console.log('');
    console.log('🔑  Seed login credentials (password: password123):');
    console.log('    Center  → center@demo.com');
    console.log('    Teacher → teacher@demo.com');
    console.log('    Student → student@demo.com');
  } catch (err: any) {
    console.error('❌  Error executing schema.sql:', err.message);
  } finally {
    await connection.end();
  }
}

runSetup();
