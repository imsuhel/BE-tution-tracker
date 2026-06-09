import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/students
// Create a new student under the logged-in center
// ─────────────────────────────────────────────────────────────
export const createStudent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, dob, class: studentClass, address, parent_name, parent_phone, photo_url, batch_id, batch_ids } = req.body;

    // Support both single batch_id and array of batch_ids
    let targetBatchIds: string[] = [];
    if (Array.isArray(batch_ids)) {
      targetBatchIds = batch_ids.filter(Boolean);
    } else if (batch_ids) {
      targetBatchIds = [batch_ids];
    } else if (batch_id) {
      targetBatchIds = [batch_id];
    }

    // Validate required fields
    if (!name || !email) {
      res.status(400).json({ error: 'Student name and email are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Resolve center from JWT
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    // Check email uniqueness
    const [existingUsers] = await pool.query<any[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    // If batches provided, verify they belong to this center
    if (targetBatchIds.length > 0) {
      const [batchRows] = await pool.query<any[]>(
        'SELECT id FROM batches WHERE id IN (?) AND center_id = ?',
        [targetBatchIds, center.id]
      );
      if (batchRows.length !== targetBatchIds.length) {
        res.status(400).json({ error: 'One or more batches not found or do not belong to this center' });
        return;
      }
    }

    // Default password: localpart@123
    const localPart = email.split('@')[0];
    const defaultPassword = `${localPart}@123`;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // --- Generate Roll Number ---
    // 1. Get abbreviation from center name
    const abbreviation = center.name
      .split(' ')
      .map((word: string) => word[0])
      .join('')
      .toUpperCase();

    // 2. Get next sequential number for this center
    const [countResult] = await pool.query<any[]>(
      'SELECT COUNT(*) as total FROM students WHERE center_id = ?',
      [center.id]
    );
    const nextNum = (countResult[0].total + 1).toString().padStart(3, '0');
    const rollNumber = `${abbreviation}-${nextNum}`;

    // Create user record
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, 'student']
    );

    // Create student record
    const studentId = uuidv4();
    await pool.query(
      `INSERT INTO students
         (id, user_id, center_id, batch_id, name, dob, class, address, parent_name, parent_phone, photo_url, roll_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        studentId,
        userId,
        center.id,
        targetBatchIds[0] || null,
        name,
        dob || null,
        studentClass || null,
        address || null,
        parent_name || null,
        parent_phone || null,
        photo_url || null,
        rollNumber
      ]
    );

    // If batches were provided, create records in batch_enrollments
    for (const bId of targetBatchIds) {
      await pool.query(
        'INSERT INTO batch_enrollments (id, student_id, batch_id) VALUES (?, ?, ?)',
        [uuidv4(), studentId, bId]
      );
    }

    // Fetch created student
    const [studentRows] = await pool.query<any[]>(
      `SELECT s.*, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
      [studentId]
    );

    res.status(201).json({
      message: 'Student created successfully',
      student: studentRows[0],
      loginCredentials: {
        email,
        defaultPassword,
        note: 'Share these credentials with the student for dashboard login.',
      },
    });
  } catch (err: any) {
    console.error('Create student error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/students
// List students with: pagination, search, filter by class,
//                     filter by fee status, sort by name
// ─────────────────────────────────────────────────────────────
export const listStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Resolve center from JWT
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    // ── Query params ──────────────────────────────────────────
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset    = (page - 1) * limit;
    const search    = (req.query.search as string || '').trim();
    const classFilter = (req.query.class as string || '').trim();
    const feeStatus = (req.query.fee_status as string || 'all').trim(); // all | pending | cleared
    const sortOrder = (req.query.sort as string || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // ── Build WHERE clause ────────────────────────────────────
    const conditions: string[] = ['s.center_id = ?'];
    const params: any[] = [center.id];

    if (search) {
      conditions.push('(s.name LIKE ? OR s.parent_name LIKE ? OR s.parent_phone LIKE ? OR s.roll_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (classFilter) {
      conditions.push('s.class = ?');
      params.push(classFilter);
    }

    // Fee status subquery filter
    if (feeStatus === 'pending') {
      // Has at least one unpaid fee
      conditions.push(`
        EXISTS (
          SELECT 1 FROM fees f
          JOIN batch_enrollments be ON f.enrollment_id = be.id
          WHERE be.student_id = s.id AND f.paid = 0
        )
      `);
    } else if (feeStatus === 'cleared') {
      // Has fee records, but NONE are unpaid
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM fees f
          JOIN batch_enrollments be ON f.enrollment_id = be.id
          WHERE be.student_id = s.id AND f.paid = 0
        )
      `);
    }

    const whereClause = conditions.join(' AND ');

    // ── Count total (for pagination meta) ─────────────────────
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM students s WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total as number;

    // ── Fetch students ────────────────────────────────────────
    const [students] = await pool.query<any[]>(
      `SELECT
          s.id,
          s.name,
          s.dob,
          s.class,
          s.address,
          s.parent_name,
          s.parent_phone,
          s.photo_url,
          s.roll_number,
          s.batch_id,
          s.created_at,
          u.email,
          GROUP_CONCAT(DISTINCT b.name SEPARATOR ', ') AS batch_name,
          -- Aggregate fee summary
          COUNT(DISTINCT f.id)                                     AS total_fees,
          COALESCE(SUM(f.amount), 0)                               AS total_amount,
          COALESCE(SUM(CASE WHEN f.paid = 1 THEN f.amount END), 0) AS paid_amount,
          COALESCE(SUM(CASE WHEN f.paid = 0 THEN f.amount END), 0) AS pending_amount
       FROM students s
       JOIN users u         ON s.user_id = u.id
       LEFT JOIN batch_enrollments be ON be.student_id = s.id
       LEFT JOIN batches b  ON be.batch_id = b.id
       LEFT JOIN fees f     ON f.enrollment_id = be.id
       WHERE ${whereClause}
       GROUP BY s.id, u.email, s.roll_number
       ORDER BY s.name ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.status(200).json({
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      filters: {
        search: search || null,
        class: classFilter || null,
        fee_status: feeStatus,
        sort: sortOrder,
      },
    });
  } catch (err: any) {
    console.error('List students error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/students/:id
// Get a single student's full details + fee summary
// ─────────────────────────────────────────────────────────────
export const getStudentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const { id } = req.params;

    const [rows] = await pool.query<any[]>(
      `SELECT
          s.*,
          u.email,
          GROUP_CONCAT(DISTINCT b.name SEPARATOR ', ') AS batch_name
       FROM students s
       JOIN users u        ON s.user_id = u.id
       LEFT JOIN batch_enrollments be ON be.student_id = s.id
       LEFT JOIN batches b ON be.batch_id = b.id
       WHERE s.id = ? AND s.center_id = ?
       GROUP BY s.id, u.email`,
      [id, center.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const student = rows[0];

    // Fetch batches for this student
    const [batches] = await pool.query<any[]>(
      `SELECT
          b.id,
          b.name,
          be.id AS enrollment_id,
          c.name AS subject,
          c.duration,
          c.monthly_fee,
          t.name AS teacher
       FROM batches b
       JOIN batch_enrollments be ON b.id = be.batch_id
       LEFT JOIN courses c ON b.course_id = c.id
       LEFT JOIN teachers t ON b.teacher_id = t.id
       WHERE be.student_id = ?`,
      [id]
    );

    // Fetch fee records for this student
    const [fees] = await pool.query<any[]>(
      `SELECT f.*, b.name as batch_name
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       WHERE be.student_id = ?
       ORDER BY f.created_at DESC`,
      [id]
    );

    // Fetch recent attendance
    const [attendance] = await pool.query<any[]>(
      `SELECT a.date, a.status, b.name as batch_name
       FROM attendance a
       JOIN batch_enrollments be ON a.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       WHERE a.student_id = ?
       ORDER BY a.date DESC
       LIMIT 10`,
      [id]
    );

    // Mock tests and reports for now to prevent frontend crashes
    const tests: any[] = [];
    const reports: any[] = [];

    res.status(200).json({ student, batches, fees, attendance, tests, reports });
  } catch (err: any) {
    console.error('Get student error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
