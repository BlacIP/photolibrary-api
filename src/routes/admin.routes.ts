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
  saveLegacyPhotoRecords,
  updateLegacyClient,
} from '../controllers/legacy-admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/storage', authMiddleware, getStorageStats);
router.post('/lifecycle/cleanup', authMiddleware, runCleanup);

/**
 * @swagger
 * /api/admin/studios:
 *   get:
 *     summary: List studios
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 */
router.get('/studios', authMiddleware, listStudios);

/**
 * @swagger
 * /api/admin/studios/{studioId}:
 *   get:
 *     summary: Get studio details
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/studios/:studioId', authMiddleware, getStudio);

/**
 * @swagger
 * /api/admin/studios/{studioId}/clients:
 *   get:
 *     summary: List studio clients (stats only)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/studios/:studioId/clients', authMiddleware, listStudioClients);

/**
 * @swagger
 * /api/admin/studios/{studioId}/clients/{clientId}:
 *   get:
 *     summary: Get studio client details (stats only)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/studios/:studioId/clients/:clientId', authMiddleware, getStudioClient);

/**
 * @swagger
 * /api/admin/studios/{studioId}/status:
 *   patch:
 *     summary: Update studio status
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, DELETED, ONBOARDING]
 */
router.patch('/studios/:studioId/status', authMiddleware, updateStudioStatus);
router.get('/legacy/clients', authMiddleware, listLegacyClients);
router.post('/legacy/clients', authMiddleware, createLegacyClient);
router.get('/legacy/clients/:id', authMiddleware, getLegacyClient);
router.put('/legacy/clients/:id', authMiddleware, updateLegacyClient);
router.delete('/legacy/clients/:id', authMiddleware, deleteLegacyClient);
router.post('/legacy/photos/upload-signature', authMiddleware, getLegacyUploadSignature);
router.post('/legacy/photos/save-record', authMiddleware, saveLegacyPhotoRecord);
router.post('/legacy/photos/save-records', authMiddleware, saveLegacyPhotoRecords);
router.delete('/legacy/photos/:id', authMiddleware, deleteLegacyPhoto);

export default router;
