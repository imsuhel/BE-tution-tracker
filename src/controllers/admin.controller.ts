import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';

/**
 * POST /api/admin/centers
 * Creates a new center with a user account.
 * Default password: {local_part_of_email}@123
 * Example: email = bright@demo.com → password = bright@123
 * No auth required (admin-only endpoint, auth to be added later)
 */
export const createCenter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, owner_name, phone, city, email, subjects, grades } = req.body;

    // --- Validation ---
    if (!name || !email) {
      res.status(400).json({ error: 'Center name and email are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // --- Check if email already exists ---
    const [existingUsers] = await pool.query<any[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existingUsers.length > 0) {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }

    // --- Generate default password: local_part@123 ---
    // e.g., bright@school.com → bright@123
    const localPart = email.split('@')[0];
    const defaultPassword = `${localPart}@123`;
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // --- Create user record ---
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userId, email, passwordHash, 'center']
    );

    // --- Create center record ---
    const centerId = uuidv4();
    await pool.query(
      `INSERT INTO centers (id, user_id, name, owner_name, phone, city, subjects, grades)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        centerId,
        userId,
        name,
        owner_name || null,
        phone || null,
        city || null,
        subjects ? JSON.stringify(subjects) : null,
        grades ? JSON.stringify(grades) : null,
      ]
    );

    // --- Fetch the created center to return ---
    const [centerRows] = await pool.query<any[]>(
      'SELECT * FROM centers WHERE id = ?',
      [centerId]
    );

    res.status(201).json({
      message: 'Center created successfully',
      center: centerRows[0],
      loginCredentials: {
        email,
        defaultPassword,
        note: 'Please share these credentials with the center. They can change the password after first login.',
      },
    });
  } catch (err: any) {
    console.error('Create center error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/centers
 * List all centers with their user info
 */
export const listCenters = async (req: Request, res: Response): Promise<void> => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT c.*, u.email, u.created_at as user_created_at
       FROM centers c
       JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );
    res.status(200).json({ centers: rows });
  } catch (err: any) {
    console.error('List centers error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/admin/centers/:id
 * Get a single center by ID
 */
export const getCenterById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<any[]>(
      `SELECT c.*, u.email, u.created_at as user_created_at
       FROM centers c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Center not found' });
      return;
    }

    res.status(200).json({ center: rows[0] });
  } catch (err: any) {
    console.error('Get center error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
