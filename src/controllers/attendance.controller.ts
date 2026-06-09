import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/attendance
// Mark attendance for a student
// ─────────────────────────────────────────────────────────────
export const bulkMarkAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { batch_id, date, records } = req.body; // records: [{student_id, enrollment_id, status}]

    if (!batch_id || !date || !Array.isArray(records)) {
      res.status(400).json({ error: 'Batch ID, Date, and Records array are required' });
      return;
    }

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Process records in a transaction or one by one
    // For simplicity and to handle updates/inserts correctly, we use a loop
    for (const record of records) {
      const { student_id, enrollment_id, status } = record;
      
      if (!status) continue; // Skip if status not provided

      // Check if attendance already exists for this student/batch/date
      // Using enrollment_id + date as unique identifier for a student's presence in a batch on a day
      const [existing] = await pool.query<any[]>(
        'SELECT id FROM attendance WHERE student_id = ? AND enrollment_id = ? AND date = ?',
        [student_id, enrollment_id, date]
      );

      if (existing.length > 0) {
        await pool.query(
          'UPDATE attendance SET status = ? WHERE id = ?',
          [status, existing[0].id]
        );
      } else {
        const attendanceId = uuidv4();
        await pool.query(
          'INSERT INTO attendance (id, student_id, enrollment_id, date, status, module_id) VALUES (?, ?, ?, ?, ?, ?)',
          [attendanceId, student_id, enrollment_id, date, status, null]
        );
      }
    }

    res.status(200).json({ message: 'Attendance processed successfully' });
  } catch (err: any) {
    console.error('Bulk mark attendance error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/attendance
// Get attendance history with filters
// ─────────────────────────────────────────────────────────────
export const getAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    const { student_id, batch_id, module_id, start_date, end_date } = req.query;

    const conditions: string[] = ['s.center_id = ?'];
    const params: any[] = [center.id];

    if (student_id) {
      conditions.push('a.student_id = ?');
      params.push(student_id);
    }
    if (batch_id) {
      conditions.push('be.batch_id = ?');
      params.push(batch_id);
    }
    if (module_id) {
      conditions.push('a.module_id = ?');
      params.push(module_id);
    }
    if (start_date && end_date) {
      conditions.push('a.date BETWEEN ? AND ?');
      params.push(start_date, end_date);
    }

    const [attendance] = await pool.query<any[]>(
      `SELECT
          a.*,
          s.name AS student_name,
          cm.name AS module_name,
          b.name AS batch_name
       FROM attendance a
       JOIN students s ON a.student_id = s.id
       LEFT JOIN course_modules cm ON a.module_id = cm.id
       JOIN batch_enrollments be ON a.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.date DESC`,
      params
    );

    res.status(200).json({ attendance });
  } catch (err: any) {
    console.error('Get attendance error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
