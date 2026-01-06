import { Router } from 'express';
import {
  listLegacyClients,
  createLegacyClient,
  getLegacyClient,
  updateLegacyClient,
  deleteLegacyClient,
} from '../controllers/legacy-admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Client management endpoints
 */

router.get('/', authMiddleware, listLegacyClients);
router.post('/', authMiddleware, createLegacyClient);
router.get('/:id', authMiddleware, getLegacyClient);
router.put('/:id', authMiddleware, updateLegacyClient);
router.delete('/:id', authMiddleware, deleteLegacyClient);

export default router;
