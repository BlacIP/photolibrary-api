import { Router } from 'express';
import {
  getLegacyUploadSignature,
  saveLegacyPhotoRecord,
  deleteLegacyPhoto,
} from '../controllers/legacy-admin.controller';
import { downloadPhoto } from '../controllers/photos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Photos
 *   description: Photo management endpoints
 */

router.post('/photos/upload-signature', authMiddleware, getLegacyUploadSignature);
router.post('/photos/save-record', authMiddleware, saveLegacyPhotoRecord);
router.get('/download', authMiddleware, downloadPhoto);
router.delete('/photos/:id', authMiddleware, deleteLegacyPhoto);

export default router;
