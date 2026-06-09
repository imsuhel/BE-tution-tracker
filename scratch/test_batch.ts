import pool from '../src/config/db';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  try {
    const batchId = uuidv4();
    const center_id = 'dc72a8ca-2816-4ab6-bb73-2fc27fecc310';
    const course_id = '842a55b8-4a24-4c4a-958a-8c2b8ee9c639';
    const teacher_id = 'd9cd7d35-c998-401b-bb3f-fcfdc9932a8b';
    const name = 'Test Batch';
    const days = ["Mon"];

    await pool.query(
      `INSERT INTO batches (id, center_id, course_id, teacher_id, name, start_date, end_date, days, timing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        center_id,
        course_id,
        teacher_id,
        name,
        null,
        null,
        JSON.stringify(days),
        '10AM',
      ]
    );
    console.log('Success');
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit();
  }
}

test();
