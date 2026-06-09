import { Router } from 'express';
import {
  createTeacher,
  listTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacher.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All teacher routes require a logged-in center
router.use(authenticate, authorizeRoles('center'));

// POST   /api/teachers         — Create a teacher
router.post('/', createTeacher);

// GET    /api/teachers         — List teachers (paginated, searchable, filterable by role)
router.get('/', listTeachers);

// GET    /api/teachers/:id     — Get single teacher + assigned batches
router.get('/:id', getTeacherById);

// PUT    /api/teachers/:id     — Update teacher details
router.put('/:id', updateTeacher);

// DELETE /api/teachers/:id     — Delete teacher
router.delete('/:id', deleteTeacher);

export default router;
