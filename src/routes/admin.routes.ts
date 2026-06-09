import { Router } from 'express';
import {
  createCenter,
  listCenters,
  getCenterById,
} from '../controllers/admin.controller';

const router = Router();

// POST /api/admin/centers — Create a new center (no auth required for now)
router.post('/centers', createCenter);

// GET /api/admin/centers — List all centers
router.get('/centers', listCenters);

// GET /api/admin/centers/:id — Get a single center
router.get('/centers/:id', getCenterById);

export default router;
