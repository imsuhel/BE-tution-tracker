import { Router } from 'express';
import { getCenterProfile, updateCenterProfile } from '../controllers/center.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, authorizeRoles('center'));

router.get('/profile', getCenterProfile);
router.put('/profile', updateCenterProfile);

export default router;
