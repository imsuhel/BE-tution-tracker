import { Router } from 'express';
import {
  createBatch,
  listBatches,
  getBatchById,
  enrollStudent,
  unenrollStudent,
  getBatchStudents,
  updateBatch,
} from '../controllers/batch.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All batch routes require center role
router.use(authenticate, authorizeRoles('center'));

router.post('/', createBatch);
router.get('/', listBatches);
router.get('/:id', getBatchById);
router.put('/:id', updateBatch);
router.post('/:id/enroll', enrollStudent);
router.delete('/:id/enroll/:studentId', unenrollStudent);
router.get('/:id/students', getBatchStudents);

export default router;
