import { Router } from 'express';
import { getClients, getClientById, updateClient, deleteClient, createClient } from '../controllers/clients.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Client management endpoints
 */

router.get('/', authMiddleware, getClients);
router.post('/', authMiddleware, createClient);
router.get('/:id', authMiddleware, getClientById);
router.put('/:id', authMiddleware, updateClient as any);
router.delete('/:id', authMiddleware, deleteClient as any);

export default router;
