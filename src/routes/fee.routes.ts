import { Router } from 'express';
import {
  createFee,
  listFees,
  markFeePaid,
} from '../controllers/fee.controller';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';

const router = Router();

// All fee routes require center role
router.use(authenticate, authorizeRoles('center'));

router.post('/', createFee);
router.get('/', listFees);
router.put('/:id/pay', markFeePaid);
router.post('/:id/pay', markFeePaid);

export default router;
