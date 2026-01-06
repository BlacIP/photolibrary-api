import { Response, Request } from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { success } from '../lib/http';
import {
    getGalleryDownloadPayload,
    getGalleryPayload,
    streamGalleryDownload,
} from '../services/gallery/gallery-service';

/**
 * @swagger
 * /api/gallery/{slug}:
 *   get:
 *     summary: Get public gallery
 *     description: Get client gallery by slug (public endpoint, no auth required)
 *     tags: [Gallery]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gallery data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 event_date:
 *                   type: string
 *                 subheading:
 *                   type: string
 *                 header_media_url:
 *                   type: string
 *                 header_media_type:
 *                   type: string
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Gallery not found
 */
export const getGallery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;
    const result = await getGalleryPayload(slug);
    success(res, result);
});

/**
 * @swagger
 * /api/gallery/{slug}/download:
 *   get:
 *     summary: Download zip of gallery
 *     tags: [Gallery]
 */
export const downloadGallery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;
    const { client, photos } = await getGalleryDownloadPayload(slug);
    await streamGalleryDownload(client, photos, res);
});
