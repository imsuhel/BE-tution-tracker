import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/teachers
// Create a new teacher under the logged-in center
// ─────────────────────────────────────────────────────────────
export const createTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, role, dob, qualification, salary, photo_url } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Teacher name and email are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

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

    // Default password: localpart@123
    const localPart = email.split('@')[0];
    const defaultPassword = `${localPart}@123`;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Create user record
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, 'teacher']
    );

    // Create teacher record
    const teacherId = uuidv4();
    await pool.query(
      `INSERT INTO teachers (id, user_id, center_id, name, role, dob, qualification, salary, photo_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        teacherId,
        userId,
        center.id,
        name,
        role || 'teacher',
        dob || null,
        qualification || null,
        salary ?? null,
        photo_url || null,
      ]
    );

    const [teacherRows] = await pool.query<any[]>(
      `SELECT t.*, u.email FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
      [teacherId]
    );

    res.status(201).json({
      message: 'Teacher created successfully',
      teacher: teacherRows[0],
      loginCredentials: {
        email,
        defaultPassword,
        note: 'Share these credentials with the teacher for dashboard login.',
      },
    });
  } catch (err: any) {
    console.error('Create teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/teachers
// List teachers: pagination, search, filter by role
// ─────────────────────────────────────────────────────────────
export const listTeachers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset    = (page - 1) * limit;
    const search    = (req.query.search as string || '').trim();
    const roleFilter = (req.query.role as string || '').trim();
    const sortOrder = (req.query.sort as string || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions: string[] = ['t.center_id = ?'];
    const params: any[] = [center.id];

    if (search) {
      conditions.push('(t.name LIKE ? OR t.qualification LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }

    if (roleFilter) {
      conditions.push('t.role = ?');
      params.push(roleFilter);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM teachers t WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total as number;

    // Fetch teachers
    const [teachers] = await pool.query<any[]>(
      `SELECT
          t.id,
          t.name,
          t.role,
          t.dob,
          t.qualification,
          t.salary,
          t.photo_url,
          t.created_at,
          u.email
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE ${whereClause}
       ORDER BY t.name ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.status(200).json({
      teachers,
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
        role: roleFilter || null,
        sort: sortOrder,
      },
    });
  } catch (err: any) {
    console.error('List teachers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/teachers/:id
// Get a single teacher's full details
// ─────────────────────────────────────────────────────────────
export const getTeacherById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [rows] = await pool.query<any[]>(
      `SELECT
          t.*,
          u.email
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND t.center_id = ?`,
      [req.params.id, center.id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    // Also fetch the batches assigned to this teacher
    const [batches] = await pool.query<any[]>(
      `SELECT b.id, b.name, c.name AS course_name
       FROM batches b
       JOIN courses c ON b.course_id = c.id
       WHERE b.teacher_id = ? AND b.center_id = ?`,
      [req.params.id, center.id]
    );

    res.status(200).json({ teacher: rows[0], batches });
  } catch (err: any) {
    console.error('Get teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/teachers/:id
// Update teacher details
// ─────────────────────────────────────────────────────────────
export const updateTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [rows] = await pool.query<any[]>(
      'SELECT id FROM teachers WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    const { name, role, dob, qualification, salary, photo_url } = req.body;

    await pool.query(
      `UPDATE teachers
       SET name          = COALESCE(?, name),
           role          = COALESCE(?, role),
           dob           = COALESCE(?, dob),
           qualification = COALESCE(?, qualification),
           salary        = COALESCE(?, salary),
           photo_url     = COALESCE(?, photo_url)
       WHERE id = ?`,
      [
        name || null,
        role || null,
        dob || null,
        qualification || null,
        salary ?? null,
        photo_url || null,
        req.params.id,
      ]
    );

    const [updated] = await pool.query<any[]>(
      `SELECT t.*, u.email FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
      [req.params.id]
    );

    res.status(200).json({ message: 'Teacher updated successfully', teacher: updated[0] });
  } catch (err: any) {
    console.error('Update teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/teachers/:id
// Delete a teacher (cascades: removes user + teacher record)
// ─────────────────────────────────────────────────────────────
export const deleteTeacher = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    // Verify teacher belongs to this center and get user_id for cascade
    const [rows] = await pool.query<any[]>(
      'SELECT id, user_id FROM teachers WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    // Deleting the user cascades to the teacher record (FK ON DELETE CASCADE)
    await pool.query('DELETE FROM users WHERE id = ?', [rows[0].user_id]);

    res.status(200).json({ message: 'Teacher deleted successfully' });
  } catch (err: any) {
    console.error('Delete teacher error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
