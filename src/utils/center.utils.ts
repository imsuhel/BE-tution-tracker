import pool from '../config/db';

/**
 * Given a user_id (from JWT), resolve the center record.
 * Returns null if no center found for this user.
 */
export const getCenterByUserId = async (userId: string): Promise<{ id: string; name: string } | null> => {
  const [rows] = await pool.query<any[]>(
    'SELECT id, name FROM centers WHERE user_id = ?',
    [userId]
  );
  return rows.length > 0 ? rows[0] : null;
};
