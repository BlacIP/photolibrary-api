import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import { encrypt } from '../lib/auth';
import bcrypt from 'bcryptjs';

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticate user and create session
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 */
export async function login(req: AuthRequest, res: Response): Promise<void> {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Missing credentials' });
            return;
        }

        // Find user
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Create session token
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const token = await encrypt({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
            },
            expiresAt: expires,
        });

        // Set HTTP-only cookie
        // For cross-domain (frontend and backend on different Vercel domains),
        // we need sameSite: 'none' and secure: true
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.VERCEL ? true : false,
            sameSite: process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'none' : 'lax',
            expires,
            path: '/',
        });

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                permissions: user.permissions,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout
 *     description: Clear session cookie
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
    // Clear cookie with same settings as when it was set (for cross-domain)
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VERCEL ? true : false,
        sameSite: process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'none' : 'lax',
        path: '/',
    });
    res.json({ success: true });
}

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     description: Get authenticated user information
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    res.json({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role,
        permissions: req.user.permissions,
    });
}

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { firstName, lastName, currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        // 1. Update Name
        if (firstName !== undefined || lastName !== undefined) {
            const newName = `${firstName || ''} ${lastName || ''}`.trim();
            if (newName.length > 0) {
                await pool.query('UPDATE users SET name = $1 WHERE id = $2', [newName, userId]);
            }
        }

        // 2. Update Password
        if (newPassword) {
            // Verify current password first
            if (!currentPassword) {
                res.status(400).json({ error: 'Current password required' });
                return;
            }

            const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
            if (!valid) {
                res.status(400).json({ error: 'Incorrect current password' });
                return;
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, userId]);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}
