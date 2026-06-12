import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/courses
// Create a new course (with optional modules)
// ─────────────────────────────────────────────────────────────
export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, duration, monthly_fee, modules } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Course name is required' });
      return;
    }

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const courseId = uuidv4();
    await pool.query(
      `INSERT INTO courses (id, center_id, name, type, duration, monthly_fee)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        center.id,
        name,
        type || 'subject',
        duration || null,
        monthly_fee ?? 0,
      ]
    );

    // Optionally insert modules if provided
    const insertedModules: any[] = [];
    if (Array.isArray(modules) && modules.length > 0) {
      for (let i = 0; i < modules.length; i++) {
        const mod = modules[i];
        if (!mod.name) continue;
        const moduleId = uuidv4();
        await pool.query(
          `INSERT INTO course_modules (id, course_id, name, order_index)
           VALUES (?, ?, ?, ?)`,
          [moduleId, courseId, mod.name, mod.order_index ?? i + 1]
        );
        insertedModules.push({ id: moduleId, name: mod.name, order_index: mod.order_index ?? i + 1 });
      }
    }

    const [courseRows] = await pool.query<any[]>(
      'SELECT * FROM courses WHERE id = ?',
      [courseId]
    );

    res.status(201).json({
      message: 'Course created successfully',
      course: courseRows[0],
      modules: insertedModules,
    });
  } catch (err: any) {
    console.error('Create course error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/courses
// List courses: search, filter by type, paginate
// ─────────────────────────────────────────────────────────────
export const listCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const page    = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset  = (page - 1) * limit;
    const search  = (req.query.search as string || '').trim();
    const type    = (req.query.type as string || '').trim();
    const sortOrder = (req.query.sort as string || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const conditions: string[] = ['c.center_id = ?'];
    const params: any[] = [center.id];

    if (search) {
      conditions.push('c.name LIKE ?');
      params.push(`%${search}%`);
    }

    if (type) {
      conditions.push('c.type = ?');
      params.push(type);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total FROM courses c WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total as number;

    // Courses + module count
    const [courses] = await pool.query<any[]>(
      `SELECT
          c.*,
          COUNT(cm.id) AS module_count
       FROM courses c
       LEFT JOIN course_modules cm ON cm.course_id = c.id
       WHERE ${whereClause}
       GROUP BY c.id
       ORDER BY c.name ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.status(200).json({
      courses,
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
        type: type || null,
        sort: sortOrder,
      },
    });
  } catch (err: any) {
    console.error('List courses error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/courses/:id
// Get a single course with all its modules
// ─────────────────────────────────────────────────────────────
export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [courseRows] = await pool.query<any[]>(
      'SELECT * FROM courses WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );

    if (courseRows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const [modules] = await pool.query<any[]>(
      'SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC',
      [req.params.id]
    );

    res.status(200).json({ course: courseRows[0], modules });
  } catch (err: any) {
    console.error('Get course error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/courses/:id
// Update course details (name, type, duration, monthly_fee)
// ─────────────────────────────────────────────────────────────
export const updateCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [courseRows] = await pool.query<any[]>(
      'SELECT id FROM courses WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (courseRows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const { name, type, duration, monthly_fee } = req.body;

    await pool.query(
      `UPDATE courses
       SET name        = COALESCE(?, name),
           type        = COALESCE(?, type),
           duration    = COALESCE(?, duration),
           monthly_fee = COALESCE(?, monthly_fee)
       WHERE id = ?`,
      [name || null, type || null, duration || null, monthly_fee ?? null, req.params.id]
    );

    const [updated] = await pool.query<any[]>('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    const [modules] = await pool.query<any[]>(
      'SELECT * FROM course_modules WHERE course_id = ? ORDER BY order_index ASC',
      [req.params.id]
    );

    res.status(200).json({ message: 'Course updated successfully', course: updated[0], modules });
  } catch (err: any) {
    console.error('Update course error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/courses/:id/modules
// Add a module to an existing course
// ─────────────────────────────────────────────────────────────
export const addModule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [courseRows] = await pool.query<any[]>(
      'SELECT id FROM courses WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (courseRows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const { name, order_index, modules } = req.body;

    // Handle bulk insertion if modules is an array
    if (Array.isArray(modules)) {
      const [maxOrder] = await pool.query<any[]>(
        'SELECT COALESCE(MAX(order_index), 0) AS max_order FROM course_modules WHERE course_id = ?',
        [req.params.id]
      );
      let currentMaxOrder = maxOrder[0].max_order;

      const insertedModules: any[] = [];
      for (let i = 0; i < modules.length; i++) {
        const modName = typeof modules[i] === 'string' ? modules[i] : modules[i].name;
        if (!modName || !modName.trim()) continue;

        currentMaxOrder += 1;
        const moduleId = uuidv4();
        await pool.query(
          'INSERT INTO course_modules (id, course_id, name, order_index) VALUES (?, ?, ?, ?)',
          [moduleId, req.params.id, modName.trim(), currentMaxOrder]
        );
        insertedModules.push({
          id: moduleId,
          course_id: req.params.id,
          name: modName.trim(),
          order_index: currentMaxOrder,
        });
      }

      res.status(201).json({ message: 'Modules added successfully', modules: insertedModules });
      return;
    }

    // Single module insertion (original behavior)
    if (!name) {
      res.status(400).json({ error: 'Module name is required' });
      return;
    }

    // Auto-assign order_index if not provided
    let finalOrder = order_index;
    if (!finalOrder) {
      const [maxOrder] = await pool.query<any[]>(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM course_modules WHERE course_id = ?',
        [req.params.id]
      );
      finalOrder = maxOrder[0].next_order;
    }

    const moduleId = uuidv4();
    await pool.query(
      'INSERT INTO course_modules (id, course_id, name, order_index) VALUES (?, ?, ?, ?)',
      [moduleId, req.params.id, name.trim(), finalOrder]
    );

    const [module] = await pool.query<any[]>('SELECT * FROM course_modules WHERE id = ?', [moduleId]);
    res.status(201).json({ message: 'Module added successfully', module: module[0] });
  } catch (err: any) {
    console.error('Add module error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/courses/:id/modules/:moduleId
// Update a specific module
// ─────────────────────────────────────────────────────────────
export const updateModule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    // Verify the course belongs to this center
    const [courseRows] = await pool.query<any[]>(
      'SELECT id FROM courses WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (courseRows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const { name, order_index } = req.body;
    await pool.query(
      `UPDATE course_modules
       SET name        = COALESCE(?, name),
           order_index = COALESCE(?, order_index)
       WHERE id = ? AND course_id = ?`,
      [name || null, order_index ?? null, req.params.moduleId, req.params.id]
    );

    const [module] = await pool.query<any[]>('SELECT * FROM course_modules WHERE id = ?', [req.params.moduleId]);
    if (module.length === 0) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    res.status(200).json({ message: 'Module updated successfully', module: module[0] });
  } catch (err: any) {
    console.error('Update module error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/courses/:id/modules/:moduleId
// Remove a module from a course
// ─────────────────────────────────────────────────────────────
export const deleteModule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found for this user' });
      return;
    }

    const [courseRows] = await pool.query<any[]>(
      'SELECT id FROM courses WHERE id = ? AND center_id = ?',
      [req.params.id, center.id]
    );
    if (courseRows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const [result] = await pool.query<any>(
      'DELETE FROM course_modules WHERE id = ? AND course_id = ?',
      [req.params.moduleId, req.params.id]
    );

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    res.status(200).json({ message: 'Module deleted successfully' });
  } catch (err: any) {
    console.error('Delete module error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
