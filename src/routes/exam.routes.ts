import { Router } from 'express';
import {
  createExam,
  getExams,
  getExamById,
  saveExamResults,
} from '../controllers/exam.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, authorizeRoles('center', 'teacher'));

router.post('/', createExam);
router.get('/', getExams);
router.get('/:id', getExamById);
router.post('/:id/results', saveExamResults);

export default router;
