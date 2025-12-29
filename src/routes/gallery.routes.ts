import { Router } from 'express';
import { getGallery, downloadGallery } from '../controllers/gallery.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Gallery
 *   description: Public gallery endpoints (no authentication required)
 */

router.get('/gallery/:slug', getGallery);
router.get('/gallery/:slug/download', downloadGallery);

export default router;
