import { Router } from 'express';
import {
  createCourse,
  listCourses,
  getCourseById,
  updateCourse,
  addModule,
  updateModule,
  deleteModule,
} from '../controllers/course.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All course routes require a logged-in center
router.use(authenticate, authorizeRoles('center'));

// ── Course routes ─────────────────────────────────────────────
// POST   /api/courses             — Create a course (+ optional modules)
router.post('/', createCourse);

// GET    /api/courses             — List courses (search, filter, paginate)
router.get('/', listCourses);

// GET    /api/courses/:id         — Get course + all modules
router.get('/:id', getCourseById);

// PUT    /api/courses/:id         — Update course details
router.put('/:id', updateCourse);

// ── Module sub-routes ─────────────────────────────────────────
// POST   /api/courses/:id/modules            — Add a module
router.post('/:id/modules', addModule);

// PUT    /api/courses/:id/modules/:moduleId  — Update a module
router.put('/:id/modules/:moduleId', updateModule);

// DELETE /api/courses/:id/modules/:moduleId  — Delete a module
router.delete('/:id/modules/:moduleId', deleteModule);

export default router;
