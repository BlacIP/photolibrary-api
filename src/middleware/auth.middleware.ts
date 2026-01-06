import { Request, Response, NextFunction } from 'express';
import { decrypt } from '../lib/auth';
import { pool } from '../lib/db';

type AuthUser = {
    id: string;
    role: string;
    permissions?: string[];
    email?: string;
    name?: string;
    first_name?: string;
    last_name?: string;
    [key: string]: unknown;
};

export interface AuthRequest extends Request {
    user?: AuthUser;
}

export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        // Try to get token from cookie first
        let token = req.cookies?.admin_token;

        // If not in cookie, try Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            res.status(401).json({ error: 'Unauthorized - No token provided' });
            return;
        }

        // Verify token
        const payload = await decrypt(token);
        if (!payload) {
            res.status(401).json({ error: 'Unauthorized - Invalid token' });
            return;
        }

        // Fetch fresh user data from database
        const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.user.id]);
        if (rows.length === 0) {
            res.status(401).json({ error: 'Unauthorized - User not found' });
            return;
        }

        req.user = rows[0];
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Unauthorized - Authentication failed' });
    }
}

export function requirePermission(permission: string) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const isSuperAdmin = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role);
        const hasPermission = req.user.permissions?.includes(permission);

        if (!isSuperAdmin && !hasPermission) {
            res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
            return;
        }

        next();
    };
}
