import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
export const getUsers = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
        throw new AppError('Forbidden', 403);
    }

    const { rows } = await pool.query(
        'SELECT id, email, first_name, last_name, role, permissions, created_at FROM users ORDER BY created_at DESC'
    );
    success(res, rows);
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create user
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               role: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       200:
 *         description: User created
 */
export const createUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
        throw new AppError('Forbidden', 403);
    }

    const { email, password, role, firstName, lastName } = req.body;

    // Basic validation
    if (!email || !password || !role) {
        throw new AppError('Missing required fields', 400);
    }

    // Check exists
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
        throw new AppError('User already exists', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    // Default permissions for ADMIN
    let permissions: string[] = [];
    if (role === 'ADMIN') {
        permissions = ['manage_clients', 'manage_photos'];
    }

    await pool.query(
        'INSERT INTO users (id, email, password_hash, role, first_name, last_name, permissions, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
        [id, email, hashedPassword, role, firstName || '', lastName || '', permissions]
    );

    success(res, { success: true, user: { id, email, role, firstName, lastName } });
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user permissions/role
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 */
export const updateUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
        throw new AppError('Forbidden', 403);
    }

    const { id } = req.params;
    const { permissions, role } = req.body;

    await pool.query(
        'UPDATE users SET permissions = $1, role = $2 WHERE id = $3',
        [permissions, role, id]
    );

    success(res, { success: true });
});
