import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import bcrypt from 'bcryptjs';

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
export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { rows } = await pool.query(
            'SELECT id, email, first_name, last_name, role, permissions, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

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
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { email, password, role, firstName, lastName } = req.body;

        // Basic validation
        if (!email || !password || !role) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        // Check exists
        const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            res.status(400).json({ error: 'User already exists' });
            return;
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

        res.json({ success: true, user: { id, email, role, firstName, lastName } });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
}

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user permissions/role
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 */
export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const { id } = req.params;
        const { permissions, role } = req.body;

        await pool.query(
            'UPDATE users SET permissions = $1, role = $2 WHERE id = $3',
            [permissions, role, id]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
}
