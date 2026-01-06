import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';
import { fetchImageStream } from '../services/gallery/gallery-helpers';
import {
    deletePhotoRecord,
    getUploadSignaturePayload,
    savePhotoRecord,
} from '../services/photos/photos-service';

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

    const payload = await getUploadSignaturePayload(clientId);
    success(res, payload);
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

    const { clientId, publicId, url, filename } = req.body;

    if (!clientId || !publicId || !url) {
        throw new AppError('Missing required fields', 400);
    }

    const result = await savePhotoRecord({ clientId, publicId, url, filename });
    success(res, result);
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
    const result = await deletePhotoRecord(id);
    success(res, result);
});

export const downloadPhoto = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const url = typeof req.query.url === 'string' ? req.query.url : undefined;
    if (!url) {
        throw new AppError('url is required', 400);
    }

    const filename = resolveDownloadFilename({
        filename: typeof req.query.filename === 'string' ? req.query.filename : undefined,
        url,
        publicId:
            typeof req.query.publicId === 'string'
                ? req.query.publicId
                : typeof req.query.public_id === 'string'
                    ? req.query.public_id
                    : undefined,
    });

    const stream = await fetchImageStream(url);
    if (!stream) {
        throw new AppError('File not found', 404);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const contentType = stream.headers['content-type'];
    if (contentType) {
        res.setHeader('Content-Type', Array.isArray(contentType) ? contentType[0] : contentType);
    }

    stream.pipe(res);
});

function resolveDownloadFilename({
    filename,
    url,
    publicId,
}: {
    filename?: string;
    url: string;
    publicId?: string;
}) {
    const direct = normalizeFilename(filename);
    if (direct) return direct;

    const fromUrl = normalizeFilename(extractFilenameFromUrl(url));
    if (fromUrl) return fromUrl;

    if (publicId) {
        return publicId.split('/').pop() || publicId;
    }

    return 'download.jpg';
}

function extractFilenameFromUrl(url: string) {
    try {
        const pathname = new URL(url).pathname;
        const lastSegment = pathname.split('/').pop();
        return lastSegment ? decodeURIComponent(lastSegment) : null;
    } catch {
        const sanitized = url.split('?')[0];
        const lastSegment = sanitized.split('/').pop();
        return lastSegment ? decodeURIComponent(lastSegment) : null;
    }
}

function normalizeFilename(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
