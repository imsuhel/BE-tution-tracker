import { Router } from 'express';
import {
  bulkMarkAttendance,
  getAttendance,
} from '../controllers/attendance.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// Restricted to center (can also allow teachers later)
router.use(authenticate, authorizeRoles('center', 'teacher'));

router.post('/', bulkMarkAttendance);
router.get('/', getAttendance);

export default router;
