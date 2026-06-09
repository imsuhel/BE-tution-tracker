import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

/**
 * POST /api/auth/login
 * Accepts: email, password
 * Works for all roles: center, teacher, student
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Fetch user by email
    const [rows] = await pool.query<any[]>(
      'SELECT id, email, password_hash, role FROM users WHERE email = ?',
      [email]
    );

    if (!rows || rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Fetch role-specific profile
    let profile: any = null;
    if (user.role === 'center') {
      const [centerRows] = await pool.query<any[]>(
        'SELECT * FROM centers WHERE user_id = ?',
        [user.id]
      );
      profile = centerRows[0] ?? null;
    } else if (user.role === 'teacher') {
      const [teacherRows] = await pool.query<any[]>(
        'SELECT * FROM teachers WHERE user_id = ?',
        [user.id]
      );
      profile = teacherRows[0] ?? null;
    } else if (user.role === 'student') {
      const [studentRows] = await pool.query<any[]>(
        'SELECT * FROM students WHERE user_id = ?',
        [user.id]
      );
      profile = studentRows[0] ?? null;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      profile,
    });
  } catch (err: any) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
