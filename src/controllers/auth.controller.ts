import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';
import { loginUser, updateUserProfile } from '../services/auth/auth-service';

export const login = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError('Missing credentials', 400);
    }

    const { token, expires, user } = await loginUser(email, password);

    // Set HTTP-only cookie
    // For cross-domain (frontend and backend on different Vercel domains),
    // we need sameSite: 'none' and secure: true
    res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VERCEL ? true : false,
        sameSite: process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'none' : 'lax',
        expires,
        path: '/',
    });

    success(res, { user });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    // Clear cookie with same settings as when it was set (for cross-domain)
    res.clearCookie('admin_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.VERCEL ? true : false,
        sameSite: process.env.NODE_ENV === 'production' || process.env.VERCEL ? 'none' : 'lax',
        path: '/',
    });
    success(res, { success: true });
});

export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    success(res, {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
        firstName: req.user.first_name,
        lastName: req.user.last_name,
        role: req.user.role,
        permissions: req.user.permissions,
    });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const result = await updateUserProfile({
        userId: req.user.id,
        firstName: req.body?.firstName,
        lastName: req.body?.lastName,
        currentPassword: req.body?.currentPassword,
        newPassword: req.body?.newPassword,
    });

    success(res, result);
});
