import { Response } from 'express';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// GET /api/center/profile
// ─────────────────────────────────────────────────────────────
export const getCenterProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(404).json({ error: 'Center profile not found' });
      return;
    }

    const [rows] = await pool.query<any[]>(
      'SELECT id, name, owner_name, phone, city, address FROM centers WHERE id = ?',
      [center.id]
    );

    res.status(200).json(rows[0]);
  } catch (err: any) {
    console.error('Get center profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/center/profile
// ─────────────────────────────────────────────────────────────
export const updateCenterProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, owner_name, phone, city, address } = req.body;
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(404).json({ error: 'Center profile not found' });
      return;
    }

    await pool.query(
      `UPDATE centers 
       SET name = COALESCE(?, name),
           owner_name = COALESCE(?, owner_name),
           phone = COALESCE(?, phone),
           city = COALESCE(?, city),
           address = COALESCE(?, address)
       WHERE id = ?`,
      [name, owner_name, phone, city, address, center.id]
    );

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err: any) {
    console.error('Update center profile error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
