import { Router } from 'express';
import { getStorageStats, runCleanup } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/storage', authMiddleware, getStorageStats);
router.post('/lifecycle/cleanup', authMiddleware, runCleanup);

export default router;
