import { Router } from 'express';
import { login } from '../controllers/auth.controller';

const router = Router();

// POST /api/auth/login — works for all roles: center, teacher, student
router.post('/login', login);

export default router;
