import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { signUploadRequest } from '../lib/cloudinary';
import cloudinary from '../lib/cloudinary';
import { randomUUID } from 'crypto';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

/**
 * @swagger
 * /api/photos/upload-signature:
 *   post:
 *     summary: Get Cloudinary upload signature
 *     description: Generate signature for direct client-to-Cloudinary upload
 *     tags: [Photos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *             properties:
 *               clientId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Upload signature generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: number
 *                 signature:
 *                   type: string
 *                 folder:
 *                   type: string
 *                 cloudName:
 *                   type: string
 *                 apiKey:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const getUploadSignature = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    // Check permissions
    const perms = req.user.permissions || [];
    const canUpload =
        ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) ||
        perms.includes('upload_photos') ||
        perms.includes('manage_photos');

    if (!canUpload) {
        throw new AppError('Permission denied', 403);
    }

    const { clientId } = req.body;

    if (!clientId) {
        throw new AppError('Client ID required', 400);
    }

    // Verify client exists
    const clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
    if (clientCheck.rows.length === 0) {
        throw new AppError('Client not found', 404);
    }

    // Generate upload signature
    // Build folder so dev uploads go to photolibrary-demo/{clientId} and prod to photolibrary/{clientId}
    const { timestamp, signature, folder: envFolder } = await signUploadRequest(clientId);
    const cfg = cloudinary.config();
    const cloudName =
        cfg.cloud_name ||
        process.env.CLOUDINARY_CLOUD_NAME ||
        process.env.CLOUDINARY_URL?.split('@')[1];
    const apiKey =
        cfg.api_key ||
        process.env.CLOUDINARY_API_KEY ||
        process.env.CLOUDINARY_URL?.split(':')[1]?.split('@')[0];

    success(res, {
        timestamp,
        signature,
        folder: envFolder,
        cloudName,
        apiKey,
        // Also provide snake_case keys for existing frontend consumption
        cloud_name: cloudName,
        api_key: apiKey,
    });
});

/**
 * @swagger
 * /api/photos/save-record:
 *   post:
 *     summary: Save photo record after upload
 *     description: Save photo metadata to database after successful Cloudinary upload
 *     tags: [Photos]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *               - publicId
 *               - url
 *             properties:
 *               clientId:
 *                 type: string
 *                 format: uuid
 *               publicId:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Photo record saved
 *       401:
 *         description: Unauthorized
 */
export const savePhotoRecord = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const { clientId, publicId, url } = req.body;

    if (!clientId || !publicId || !url) {
        throw new AppError('Missing required fields', 400);
    }

    // Extract filename from public_id
    const filename = publicId.split('/').pop() || 'uploaded_file';

    // Save to database
    await pool.query(
        'INSERT INTO photos (id, client_id, url, filename, public_id) VALUES ($1, $2, $3, $4, $5)',
        [randomUUID(), clientId, url, filename, publicId]
    );

    success(res, { success: true });
});

/**
 * @swagger
 * /api/photos/{id}:
 *   delete:
 *     summary: Delete photo
 *     description: Delete photo from Cloudinary and database
 *     tags: [Photos]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Photo deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 *       404:
 *         description: Photo not found
 */
export const deletePhoto = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    // Check permissions
    const canDelete = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) ||
        req.user.permissions?.includes('manage_photos') ||
        req.user.permissions?.includes('delete_photos');

    if (!canDelete) {
        throw new AppError('Forbidden', 403);
    }

    const { id } = req.params;

    // Fetch photo details
    const photoResult = await pool.query('SELECT public_id FROM photos WHERE id = $1', [id]);

    if (photoResult.rows.length === 0) {
        throw new AppError('Photo not found', 404);
    }

    const photo = photoResult.rows[0];

    // Delete from Cloudinary
    try {
        await cloudinary.uploader.destroy(photo.public_id);
        console.log(`Deleted from Cloudinary: ${photo.public_id}`);
    } catch (cloudinaryError) {
        console.error(`Failed to delete from Cloudinary: ${photo.public_id}`, cloudinaryError);
        // Continue with database deletion even if Cloudinary deletion fails
    }

    // Delete from database
    await pool.query('DELETE FROM photos WHERE id = $1', [id]);

    success(res, { success: true });
});
