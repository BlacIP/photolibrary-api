import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { signUploadRequest } from '../lib/cloudinary';
import cloudinary from '../lib/cloudinary';
import { randomUUID } from 'crypto';

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
export async function getUploadSignature(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permissions
        const perms = req.user.permissions || [];
        const canUpload =
            ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) ||
            perms.includes('upload_photos') ||
            perms.includes('manage_photos');

        if (!canUpload) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const { clientId } = req.body;

        if (!clientId) {
            res.status(400).json({ error: 'Client ID required' });
            return;
        }

        // Verify client exists
        const clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
        if (clientCheck.rows.length === 0) {
            res.status(404).json({ error: 'Client not found' });
            return;
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

        res.json({
            timestamp,
            signature,
            folder: envFolder,
            cloudName,
            apiKey,
            // Also provide snake_case keys for existing frontend consumption
            cloud_name: cloudName,
            api_key: apiKey,
        });
    } catch (error) {
        console.error('Error generating upload signature:', error);
        res.status(500).json({ error: 'Failed to generate upload signature' });
    }
}

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
export async function savePhotoRecord(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { clientId, publicId, url } = req.body;

        if (!clientId || !publicId || !url) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Extract filename from public_id
        const filename = publicId.split('/').pop() || 'uploaded_file';

        // Save to database
        await pool.query(
            'INSERT INTO photos (id, client_id, url, filename, public_id) VALUES ($1, $2, $3, $4, $5)',
            [randomUUID(), clientId, url, filename, publicId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving photo record:', error);
        res.status(500).json({ error: 'Failed to save photo record' });
    }
}

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
export async function deletePhoto(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Check permissions
        const canDelete = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) ||
            req.user.permissions?.includes('manage_photos') ||
            req.user.permissions?.includes('delete_photos');

        if (!canDelete) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { id } = req.params;

        // Fetch photo details
        const photoResult = await pool.query('SELECT public_id FROM photos WHERE id = $1', [id]);

        if (photoResult.rows.length === 0) {
            res.status(404).json({ error: 'Photo not found' });
            return;
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

        res.json({ success: true });
    } catch (error) {
        console.error('Delete photo error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
}
