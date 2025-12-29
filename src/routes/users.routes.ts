import { Router } from 'express';
import { getUsers, createUser, updateUser } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authMiddleware, getUsers);
router.post('/', authMiddleware, createUser as any);
router.put('/:id', authMiddleware, updateUser as any);

export default router;
