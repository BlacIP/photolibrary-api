import { Router } from 'express';
import { login, logout, getCurrentUser, updateProfile } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/me', authMiddleware, getCurrentUser);
router.put('/auth/profile', authMiddleware, updateProfile as any);

export default router;
