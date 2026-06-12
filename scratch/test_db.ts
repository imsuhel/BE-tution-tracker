import pool from '../src/config/db';

async function run() {
  const [rows] = await pool.query('SELECT f.*, s.name as student_name FROM fees f JOIN batch_enrollments be ON f.enrollment_id = be.id JOIN students s ON be.student_id = s.id');
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
run();
