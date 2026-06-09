import { Router } from 'express';
import { createStudent, listStudents, getStudentById } from '../controllers/student.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All student routes require a logged-in center
router.use(authenticate, authorizeRoles('center'));

// POST   /api/students         — Create a student
router.post('/', createStudent);

// GET    /api/students         — List students (paginated, searchable, filterable)
router.get('/', listStudents);

// GET    /api/students/:id     — Get single student + fees
router.get('/:id', getStudentById);

export default router;
