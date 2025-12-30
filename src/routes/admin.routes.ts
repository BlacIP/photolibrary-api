import { Router } from 'express';
import { getStorageStats, runCleanup } from '../controllers/admin.controller';
import {
  listStudios,
  getStudio,
  listStudioClients,
  getStudioClient,
  updateStudioStatus,
} from '../controllers/studios-admin.controller';
import {
  createLegacyClient,
  deleteLegacyClient,
  deleteLegacyPhoto,
  getLegacyClient,
  getLegacyUploadSignature,
  listLegacyClients,
  saveLegacyPhotoRecord,
  updateLegacyClient,
} from '../controllers/legacy-admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/storage', authMiddleware, getStorageStats);
router.post('/lifecycle/cleanup', authMiddleware, runCleanup);
router.get('/studios', authMiddleware, listStudios);
router.get('/studios/:studioId', authMiddleware, getStudio);
router.get('/studios/:studioId/clients', authMiddleware, listStudioClients);
router.get('/studios/:studioId/clients/:clientId', authMiddleware, getStudioClient);
router.patch('/studios/:studioId/status', authMiddleware, updateStudioStatus);
router.get('/legacy/clients', authMiddleware, listLegacyClients);
router.post('/legacy/clients', authMiddleware, createLegacyClient);
router.get('/legacy/clients/:id', authMiddleware, getLegacyClient);
router.put('/legacy/clients/:id', authMiddleware, updateLegacyClient);
router.delete('/legacy/clients/:id', authMiddleware, deleteLegacyClient);
router.post('/legacy/photos/upload-signature', authMiddleware, getLegacyUploadSignature);
router.post('/legacy/photos/save-record', authMiddleware, saveLegacyPhotoRecord);
router.delete('/legacy/photos/:id', authMiddleware, deleteLegacyPhoto);

export default router;
