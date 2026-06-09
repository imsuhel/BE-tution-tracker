import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/fees
// Create a fee record for an enrollment
// ─────────────────────────────────────────────────────────────
export const createFee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { enrollment_id, amount, month, is_payment, payment_method } = req.body;

    if (!enrollment_id || !amount) {
      res.status(400).json({ error: 'Enrollment ID and amount are required' });
      return;
    }

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Verify enrollment belongs to center and fetch course details
    const [enrollmentRows] = await pool.query<any[]>(
      `SELECT be.id, c.duration, c.monthly_fee 
       FROM batch_enrollments be
       JOIN batches b ON be.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       WHERE be.id = ? AND b.center_id = ?`,
      [enrollment_id, center.id]
    );
    if (enrollmentRows.length === 0) {
      res.status(404).json({ error: 'Enrollment not found' });
      return;
    }

    const enrollment = enrollmentRows[0];
    const durationMonths = parseInt(enrollment.duration) || 0;
    const totalExpected = durationMonths * enrollment.monthly_fee;

    // Calculate total paid so far
    const [paidRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM fees
       WHERE enrollment_id = ? AND paid = 1`,
      [enrollment_id]
    );
    const totalPaid = Number(paidRows[0].total_paid);
    const pendingAmount = Math.max(0, totalExpected - totalPaid);

    if (is_payment) {
      if (Number(amount) > pendingAmount) {
        res.status(400).json({
          error: `Cannot record payment of ${amount}. The pending amount for this course is ${pendingAmount}.`
        });
        return;
      }
    }

    const feeId = uuidv4();
    
    const currentDate = new Date();
    const defaultMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    const finalMonth = month || defaultMonth;

    if (is_payment) {
      await pool.query(
        `INSERT INTO fees (id, enrollment_id, month, amount, paid, payment_date, payment_method) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)`,
        [feeId, enrollment_id, finalMonth, amount, payment_method || 'Cash']
      );
    } else {
      await pool.query(
        `INSERT INTO fees (id, enrollment_id, month, amount) VALUES (?, ?, ?, ?)`,
        [feeId, enrollment_id, finalMonth, amount]
      );
    }

    const [fee] = await pool.query<any[]>(
      `SELECT f.*, s.name as student_name, s.roll_number as roll_number, b.name as batch_name
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN students s ON be.student_id = s.id
       JOIN batches b ON be.batch_id = b.id
       WHERE f.id = ?`,
      [feeId]
    );

    res.status(201).json({ message: 'Fee record created', fee: fee[0] });
  } catch (err: any) {
    console.error('Create fee error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/fees
// List fees: filters (student_id, batch_id, status), paginate
// ─────────────────────────────────────────────────────────────
export const listFees = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset    = (page - 1) * limit;
    const studentId = (req.query.student_id as string || '').trim();
    const batchId   = (req.query.batch_id as string || '').trim();
    const status    = (req.query.status as string || '').trim(); // paid | pending

    const conditions: string[] = ['b.center_id = ?'];
    const params: any[] = [center.id];

    if (studentId) {
      conditions.push('be.student_id = ?');
      params.push(studentId);
    }
    if (batchId) {
      conditions.push('be.batch_id = ?');
      params.push(batchId);
    }
    if (status === 'paid') {
      conditions.push('f.paid = 1');
    } else if (status === 'pending') {
      conditions.push('f.paid = 0');
    }

    const whereClause = conditions.join(' AND ');

    const [countRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as total
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       WHERE ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    const [fees] = await pool.query<any[]>(
      `SELECT
          f.*,
          s.name AS student_name,
          s.roll_number AS roll_number,
          b.name AS batch_name,
          (
            COALESCE(CAST(c.duration AS UNSIGNED), 0) * c.monthly_fee
          ) AS course_total_fee,
          (
            SELECT COALESCE(SUM(f2.amount), 0)
            FROM fees f2
            WHERE f2.enrollment_id = f.enrollment_id AND f2.paid = 1
          ) AS course_paid_amount
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN students s ON be.student_id = s.id
       JOIN batches b ON be.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       WHERE ${whereClause}
       ORDER BY f.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [metricsRows] = await pool.query<any[]>(
      `SELECT
          COALESCE(SUM(CASE WHEN f.paid = 0 THEN f.amount END), 0) AS totalPending,
          COALESCE(SUM(CASE WHEN f.paid = 1 AND MONTH(f.payment_date) = MONTH(CURRENT_DATE()) AND YEAR(f.payment_date) = YEAR(CURRENT_DATE()) THEN f.amount END), 0) AS collectedThisMonth,
          0 AS overdue
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       WHERE b.center_id = ?`,
      [center.id]
    );

    const metrics = {
      totalPending: Number(metricsRows[0].totalPending),
      collectedThisMonth: Number(metricsRows[0].collectedThisMonth),
      overdue: Number(metricsRows[0].overdue)
    };

    res.status(200).json({
      fees,
      metrics,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    });
  } catch (err: any) {
    console.error('List fees error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/fees/:id/pay
// Mark fee as paid
// ─────────────────────────────────────────────────────────────
export const markFeePaid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { payment_method, amount } = req.body;
    const { id: feeId } = req.params;

    const center = await getCenterByUserId(req.user!.id);
    if (!center) {
      res.status(403).json({ error: 'Center profile not found' });
      return;
    }

    // Verify fee belongs to center and fetch enrollment/course details
    const [feeRows] = await pool.query<any[]>(
      `SELECT f.id, f.enrollment_id, f.amount AS original_amount, f.paid,
              c.duration, c.monthly_fee
       FROM fees f
       JOIN batch_enrollments be ON f.enrollment_id = be.id
       JOIN batches b ON be.batch_id = b.id
       JOIN courses c ON b.course_id = c.id
       WHERE f.id = ? AND b.center_id = ?`,
      [feeId, center.id]
    );
    if (feeRows.length === 0) {
      res.status(404).json({ error: 'Fee record not found' });
      return;
    }

    const feeRecord = feeRows[0];
    if (feeRecord.paid === 1 || feeRecord.paid === true) {
      res.status(400).json({ error: 'Fee is already marked as paid' });
      return;
    }

    const enrollment_id = feeRecord.enrollment_id;
    const finalAmount = amount !== undefined ? Number(amount) : Number(feeRecord.original_amount);

    const durationMonths = parseInt(feeRecord.duration) || 0;
    const totalExpected = durationMonths * feeRecord.monthly_fee;

    // Fetch total paid so far (excluding the current fee record, since it is not paid yet)
    const [paidRows] = await pool.query<any[]>(
      `SELECT COALESCE(SUM(amount), 0) AS total_paid
       FROM fees
       WHERE enrollment_id = ? AND paid = 1 AND id != ?`,
      [enrollment_id, feeId]
    );
    const totalPaid = Number(paidRows[0].total_paid);
    const pendingAmount = Math.max(0, totalExpected - totalPaid);

    if (finalAmount > pendingAmount) {
      res.status(400).json({
        error: `Cannot record payment of ${finalAmount}. The pending amount for this course is ${pendingAmount}.`
      });
      return;
    }

    await pool.query(
      `UPDATE fees SET paid = 1, payment_date = CURRENT_TIMESTAMP, payment_method = ?, amount = ? WHERE id = ?`,
      [payment_method || 'Cash', finalAmount, feeId]
    );

    res.status(200).json({ message: 'Fee marked as paid' });
  } catch (err: any) {
    console.error('Mark fee paid error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
