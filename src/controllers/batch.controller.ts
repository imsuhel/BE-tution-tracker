import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/batches
// Create a new batch
// ─────────────────────────────────────────────────────────────
export const createBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, course_id, teacher_id, start_date, end_date, days, timing, max_seats } = req.body;

    if (!name || !course_id || !teacher_id) {
      res.status(400).json({ error: 'Name, Course ID, and Teacher ID are required' });
      return;
    }

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    // Verify course exists and belongs to this center
    const [courseRows] = await pool.query<any[]>(
      'SELECT id FROM courses WHERE id = ? AND center_id = ?',
      [course_id, center.id]
    );
    if (courseRows.length === 0) {
      res.status(400).json({ error: 'Course not found or does not belong to this center' });
      return;
    }

    // Verify teacher exists and belongs to this center
    const [teacherRows] = await pool.query<any[]>(
      'SELECT id FROM teachers WHERE id = ? AND center_id = ?',
      [teacher_id, center.id]
    );
    if (teacherRows.length === 0) {
      res.status(400).json({ error: 'Teacher not found or does not belong to this center' });
      return;
    }

    const batchId = uuidv4();
    await pool.query(
      `INSERT INTO batches (id, center_id, course_id, teacher_id, name, start_date, end_date, days, timing, max_seats)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        center.id,
        course_id,
        teacher_id,
        name,
        start_date || null,
        end_date || null,
        JSON.stringify(days || []),
        timing || null,
        max_seats || 0
      ]
    );

    const [batch] = await pool.query<any[]>(
      `SELECT b.*, c.name as course_name, t.name as teacher_name
       FROM batches b
       JOIN courses c ON b.course_id = c.id
       JOIN teachers t ON b.teacher_id = t.id
       WHERE b.id = ?`,
      [batchId]
    );

    res.status(201).json({ message: 'Batch created successfully', batch: batch[0] });
  } catch (err: any) {
    console.error('Create batch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/batches
// List batches: search, filter by course/teacher/status, paginate
// ─────────────────────────────────────────────────────────────
export const listBatches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset    = (page - 1) * limit;
    const search    = (req.query.search as string || '').trim();
    const courseId  = (req.query.course_id as string || '').trim();
    const teacherId = (req.query.teacher_id as string || '').trim();
    const status    = (req.query.status as string || '').trim();

    const conditions: string[] = ['b.center_id = ?'];
    const params: any[] = [center.id];

    if (search) {
      conditions.push('b.name LIKE ?');
      params.push(`%${search}%`);
    }
    if (courseId) {
      conditions.push('b.course_id = ?');
      params.push(courseId);
    }
    if (teacherId) {
      conditions.push('b.teacher_id = ?');
      params.push(teacherId);
    }
    if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM batches b WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [batches] = await pool.query<any[]>(
      `SELECT
          b.*,
          c.name AS course_name,
          t.name AS teacher_name,
          (SELECT COUNT(*) FROM batch_enrollments be WHERE be.batch_id = b.id) AS student_count
       FROM batches b
       JOIN courses c ON b.course_id = c.id
       JOIN teachers t ON b.teacher_id = t.id
       WHERE ${whereClause}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.status(200).json({
      batches,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (err: any) {
    console.error('List batches error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/batches/:id/enroll
// Enroll a student in a batch
// ─────────────────────────────────────────────────────────────
export const enrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { student_id } = req.body;
    const { id: batchId } = req.params;

    if (!student_id) {
      res.status(400).json({ error: 'Student ID is required' });
      return;
    }

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Verify batch belongs to center and check seats
    const [batchRows] = await pool.query<any[]>(
      `SELECT b.id, b.max_seats, (SELECT COUNT(*) FROM batch_enrollments be WHERE be.batch_id = b.id) as current_enrolled 
       FROM batches b 
       WHERE b.id = ? AND b.center_id = ?`,
      [batchId, center.id]
    );
    if (batchRows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const batchInfo = batchRows[0];
    if (batchInfo.max_seats > 0 && batchInfo.current_enrolled >= batchInfo.max_seats) {
      res.status(400).json({ error: `Batch is full. Maximum seats: ${batchInfo.max_seats}` });
      return;
    }

    // Verify student belongs to center
    const [studentRows] = await pool.query<any[]>(
      'SELECT id FROM students WHERE id = ? AND center_id = ?',
      [student_id, center.id]
    );
    if (studentRows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Check if already enrolled
    const [existing] = await pool.query<any[]>(
      'SELECT id FROM batch_enrollments WHERE student_id = ? AND batch_id = ?',
      [student_id, batchId]
    );
    if (existing.length > 0) {
      res.status(409).json({ error: 'Student is already enrolled in this batch' });
      return;
    }

    const enrollmentId = uuidv4();
    await pool.query(
      'INSERT INTO batch_enrollments (id, student_id, batch_id) VALUES (?, ?, ?)',
      [enrollmentId, student_id, batchId]
    );

    // Update student's primary batch_id as well
    await pool.query('UPDATE students SET batch_id = ? WHERE id = ?', [batchId, student_id]);

    res.status(201).json({ message: 'Student enrolled successfully', enrollmentId });
  } catch (err: any) {
    console.error('Enroll student error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/batches/:id/students
// Get list of students in a batch
// ─────────────────────────────────────────────────────────────
export const getBatchStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    const [students] = await pool.query<any[]>(
      `SELECT s.id, s.name, s.class, s.parent_phone, s.roll_number, u.email, be.enrolled_at, be.id AS enrollment_id
       FROM batch_enrollments be
       JOIN students s ON be.student_id = s.id
       JOIN users u ON s.user_id = u.id
       WHERE be.batch_id = ? AND s.center_id = ?`,
      [req.params.id, center.id]
    );

    res.status(200).json({ students });
  } catch (err: any) {
    console.error('Get batch students error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
// ─────────────────────────────────────────────────────────────
// GET /api/batches/:id
// Get a single batch by ID
// ─────────────────────────────────────────────────────────────
export const getBatchById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    const [batch] = await pool.query<any[]>(
      `SELECT b.*, c.name as course_name, t.name as teacher_name
       FROM batches b
       JOIN courses c ON b.course_id = c.id
       JOIN teachers t ON b.teacher_id = t.id
       WHERE b.id = ? AND b.center_id = ?`,
      [req.params.id, center.id]
    );

    if (batch.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    res.status(200).json({ batch: batch[0] });
  } catch (err: any) {
    console.error('Get batch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/batches/:id/enroll/:studentId
// Unenroll a student from a batch
// ─────────────────────────────────────────────────────────────
export const unenrollStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: batchId, studentId } = req.params;
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Verify batch belongs to center
    const [batchRows] = await pool.query<any[]>(
      'SELECT id FROM batches WHERE id = ? AND center_id = ?',
      [batchId, center.id]
    );
    if (batchRows.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    const [result] = await pool.query<any>(
      'DELETE FROM batch_enrollments WHERE batch_id = ? AND student_id = ?',
      [batchId, studentId]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Enrollment not found' });
      return;
    }

    // Optionally clear student's batch_id if it was this one
    await pool.query('UPDATE students SET batch_id = NULL WHERE id = ? AND batch_id = ?', [studentId, batchId]);

    res.status(200).json({ message: 'Student unenrolled successfully' });
  } catch (err: any) {
    console.error('Unenroll student error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/batches/:id
// Update a batch
// ─────────────────────────────────────────────────────────────
export const updateBatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, teacher_id, course_id, start_date, end_date, timing, max_seats, status } = req.body;

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Verify batch belongs to center
    const [existing] = await pool.query<any[]>(
      'SELECT id FROM batches WHERE id = ? AND center_id = ?',
      [id, center.id]
    );
    if (existing.length === 0) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }

    await pool.query(
      `UPDATE batches 
       SET name = COALESCE(?, name),
           teacher_id = COALESCE(?, teacher_id),
           course_id = COALESCE(?, course_id),
           start_date = COALESCE(?, start_date),
           end_date = COALESCE(?, end_date),
           timing = COALESCE(?, timing),
           max_seats = COALESCE(?, max_seats),
           status = COALESCE(?, status)
       WHERE id = ? AND center_id = ?`,
      [name, teacher_id, course_id, start_date, end_date, timing, max_seats, status, id, center.id]
    );

    res.status(200).json({ message: 'Batch updated successfully' });
  } catch (err: any) {
    console.error('Update batch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
