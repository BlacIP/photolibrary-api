import { Router } from 'express';
import { getUploadSignature, savePhotoRecord, deletePhoto } from '../controllers/photos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Photos
 *   description: Photo management endpoints
 */

router.post('/photos/upload-signature', authMiddleware, getUploadSignature);
router.post('/photos/save-record', authMiddleware, savePhotoRecord);
router.delete('/photos/:id', authMiddleware, deletePhoto);

export default router;
