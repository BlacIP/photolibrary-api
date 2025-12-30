import { Router } from 'express';
import { getStorageStats, runCleanup } from '../controllers/admin.controller';
import {
  listStudios,
  getStudio,
  listStudioClients,
  getStudioClient,
  updateStudioStatus,
} from '../controllers/studios-admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/storage', authMiddleware, getStorageStats);
router.post('/lifecycle/cleanup', authMiddleware, runCleanup);
router.get('/studios', authMiddleware, listStudios);
router.get('/studios/:studioId', authMiddleware, getStudio);
router.get('/studios/:studioId/clients', authMiddleware, listStudioClients);
router.get('/studios/:studioId/clients/:clientId', authMiddleware, getStudioClient);
router.patch('/studios/:studioId/status', authMiddleware, updateStudioStatus);

export default router;
