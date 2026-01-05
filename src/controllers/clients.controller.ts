import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { randomUUID } from 'crypto';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Get all clients
 *     description: Retrieve a list of all clients (active and archived)
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getClients = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { rows } = await pool.query(
        `SELECT c.*, COUNT(p.id) as photo_count 
         FROM clients c
         LEFT JOIN photos p ON c.id = p.client_id
         GROUP BY c.id
         ORDER BY c.created_at DESC`
    );

    success(res, rows);
});

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - event_date
 *             properties:
 *               name:
 *                 type: string
 *               event_date:
 *                 type: string
 *                 format: date
 *               subheading:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Client created
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
/**
 * Create client
 */
export const createClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const permissions = req.user.permissions || [];
    const canCreate = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) || permissions.includes('manage_clients');
    if (!canCreate) {
        throw new AppError('Forbidden', 403);
    }

    // Accept both event_date and legacy "date" from older frontend
    const { name, subheading = null, event_date, date } = req.body;
    const eventDate = event_date || date;

    if (!name || !eventDate) {
        throw new AppError('Name and event_date are required', 400);
    }

    const slug = name.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    const id = randomUUID();
    const insertQuery = `
      INSERT INTO clients (id, name, slug, subheading, event_date, status)
      VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
      RETURNING id, name, slug, subheading, event_date, status
    `;

    const { rows } = await pool.query(insertQuery, [id, name, slug, subheading, eventDate]);
    success(res, rows[0], 201);
});

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Get client by ID
 *     description: Retrieve a single client with all their photos
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Client details with photos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 client:
 *                   $ref: '#/components/schemas/Client'
 *                 photos:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Photo'
 *       404:
 *         description: Client not found
 *       401:
 *         description: Unauthorized
 */
export const getClientById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Get client
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
        throw new AppError('Client not found', 404);
    }

    // Get photos
    const photosResult = await pool.query(
        'SELECT id, url, filename, public_id, created_at FROM photos WHERE client_id = $1 ORDER BY created_at DESC LIMIT 500',
        [id]
    );

    success(res, {
        client: clientResult.rows[0],
        photos: photosResult.rows,
    });
});

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     summary: Update client
 *     description: Update client details, status, or header media
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, ARCHIVED, DELETED]
 *               subheading:
 *                 type: string
 *               event_date:
 *                 type: string
 *                 format: date
 *               header_media_url:
 *                 type: string
 *                 nullable: true
 *               header_media_type:
 *                 type: string
 *                 enum: [image, video]
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Client updated
 *       403:
 *         description: Forbidden
 */
export const updateClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body;

    // Permission check
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const permissions = req.user.permissions || [];
    const canEdit = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) || permissions.includes('manage_clients');

    if (!canEdit) {
        throw new AppError('Forbidden', 403);
    }

    // Dynamic Query Construction
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.header_media_url !== undefined) {
        updates.push(`header_media_url = $${paramIndex++}`);
        values.push(body.header_media_url);
    }
    if (body.header_media_type !== undefined) {
        updates.push(`header_media_type = $${paramIndex++}`);
        values.push(body.header_media_type);
    }
    if (body.status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(body.status);
        updates.push(`status_updated_at = NOW()`);
    }
    if (body.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(body.name);

        // Regenerate slug
        const slug = body.name.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');

        updates.push(`slug = $${paramIndex++}`);
        values.push(slug);
    }
    if (body.subheading !== undefined) {
        updates.push(`subheading = $${paramIndex++}`);
        values.push(body.subheading);
    }
    if (body.event_date !== undefined) {
        updates.push(`event_date = $${paramIndex++}`);
        values.push(body.event_date);
    }

    if (updates.length > 0) {
        values.push(id);
        const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
        await pool.query(query, values);
    }

    success(res, { success: true });
});

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Delete client
 *     description: Permanently delete client and all photos
 *     tags: [Clients]
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
 *         description: Client deleted
 *       403:
 *         description: Forbidden
 */
export const deleteClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Permission check
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const permissions = req.user.permissions || [];
    const canDelete = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) || permissions.includes('manage_clients');

    if (!canDelete) {
        throw new AppError('Forbidden', 403);
    }

    // Fetch photos to delete from Cloudinary
    const photosResult = await pool.query('SELECT public_id FROM photos WHERE client_id = $1', [id]);

    if (photosResult.rows.length > 0) {
        const cloudinary = require('cloudinary').v2; // Lazy load or import at top

        for (const photo of photosResult.rows) {
            try {
                await cloudinary.uploader.destroy(photo.public_id);
            } catch (e) {
                console.error(`Failed to delete Cloudinary image: ${photo.public_id}`, e);
            }
        }
    }

    // Delete from DB
    await pool.query('DELETE FROM photos WHERE client_id = $1', [id]);
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);

    success(res, { success: true });
});
