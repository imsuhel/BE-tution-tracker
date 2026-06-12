import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db';
import { AuthRequest } from '../middlewares/auth.middleware';
import { getCenterByUserId } from '../utils/center.utils';

// ─────────────────────────────────────────────────────────────
// POST /api/exams
// Create an exam with its papers in one request
// Body: { batch_id, name, exam_date, papers: [{name, max_marks, passing_marks}] }
// ─────────────────────────────────────────────────────────────
export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) { res.status(403).json({ error: 'Center profile not found' }); return; }

    const { batch_id, name, exam_date, papers } = req.body;
    if (!batch_id || !name) {
      res.status(400).json({ error: 'batch_id and name are required' });
      return;
    }
    if (!Array.isArray(papers) || papers.length === 0) {
      res.status(400).json({ error: 'At least one paper is required' });
      return;
    }

    // Verify batch belongs to this center
    const [batches] = await pool.query<any[]>(
      'SELECT id FROM batches WHERE id = ? AND center_id = ?',
      [batch_id, center.id]
    );
    if (!batches.length) { res.status(404).json({ error: 'Batch not found' }); return; }

    const examId = uuidv4();
    await pool.query(
      'INSERT INTO exams (id, batch_id, center_id, name, exam_date) VALUES (?, ?, ?, ?, ?)',
      [examId, batch_id, center.id, name, exam_date || null]
    );

    // Insert all papers
    for (let i = 0; i < papers.length; i++) {
      const { name: pName, max_marks = 100, passing_marks = 35 } = papers[i];
      await pool.query(
        'INSERT INTO exam_papers (id, exam_id, name, max_marks, passing_marks, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), examId, pName, max_marks, passing_marks, i]
      );
    }

    const [exam] = await pool.query<any[]>(
      'SELECT * FROM exams WHERE id = ?', [examId]
    );
    const [examPapers] = await pool.query<any[]>(
      'SELECT * FROM exam_papers WHERE exam_id = ? ORDER BY order_index', [examId]
    );

    res.status(201).json({ exam: exam[0], papers: examPapers });
  } catch (err: any) {
    console.error('createExam error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/exams?batch_id=X
// List all exams for a batch (with paper count)
// ─────────────────────────────────────────────────────────────
export const getExams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) { res.status(403).json({ error: 'Center profile not found' }); return; }

    const { batch_id } = req.query;
    if (!batch_id) { res.status(400).json({ error: 'batch_id is required' }); return; }

    const [exams] = await pool.query<any[]>(
      `SELECT e.*, COUNT(ep.id) AS paper_count
       FROM exams e
       LEFT JOIN exam_papers ep ON ep.exam_id = e.id
       WHERE e.batch_id = ? AND e.center_id = ?
       GROUP BY e.id
       ORDER BY e.created_at DESC`,
      [batch_id, center.id]
    );

    res.json({ exams });
  } catch (err: any) {
    console.error('getExams error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/exams/:id
// Get exam with its papers + enrolled students + their results
// ─────────────────────────────────────────────────────────────
export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) { res.status(403).json({ error: 'Center profile not found' }); return; }

    const { id } = req.params;

    const [exams] = await pool.query<any[]>(
      'SELECT e.* FROM exams e WHERE e.id = ? AND e.center_id = ?',
      [id, center.id]
    );
    if (!exams.length) { res.status(404).json({ error: 'Exam not found' }); return; }

    const [papers] = await pool.query<any[]>(
      'SELECT * FROM exam_papers WHERE exam_id = ? ORDER BY order_index',
      [id]
    );

    // Get enrolled students for this batch
    const [students] = await pool.query<any[]>(
      `SELECT s.id, s.name, s.roll_number, be.id AS enrollment_id
       FROM batch_enrollments be
       JOIN students s ON s.id = be.student_id
       WHERE be.batch_id = ?
       ORDER BY s.roll_number, s.name`,
      [exams[0].batch_id]
    );

    // Get all results for this exam
    const [results] = await pool.query<any[]>(
      'SELECT * FROM exam_results WHERE exam_id = ?',
      [id]
    );

    res.json({ exam: exams[0], papers, students, results });
  } catch (err: any) {
    console.error('getExamById error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/exams/:id/results
// Bulk upsert exam results
// Body: { results: [{paper_id, student_id, enrollment_id, marks_obtained}] }
// ─────────────────────────────────────────────────────────────
export const saveExamResults = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const center = await getCenterByUserId(req.user!.id);
    if (!center) { res.status(403).json({ error: 'Center profile not found' }); return; }

    const { id } = req.params;
    const { results } = req.body;

    if (!Array.isArray(results)) {
      res.status(400).json({ error: 'results must be an array' });
      return;
    }

    // Verify exam belongs to this center
    const [exams] = await pool.query<any[]>(
      'SELECT id FROM exams WHERE id = ? AND center_id = ?',
      [id, center.id]
    );
    if (!exams.length) { res.status(404).json({ error: 'Exam not found' }); return; }

    for (const r of results) {
      const { paper_id, student_id, enrollment_id, marks_obtained } = r;
      // UPSERT: insert or update on duplicate key (exam_id + paper_id + student_id)
      await pool.query(
        `INSERT INTO exam_results (id, exam_id, paper_id, student_id, enrollment_id, marks_obtained)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained)`,
        [uuidv4(), id, paper_id, student_id, enrollment_id, marks_obtained ?? null]
      );
    }

    res.json({ success: true, saved: results.length });
  } catch (err: any) {
    console.error('saveExamResults error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};
