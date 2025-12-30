import { Router } from 'express';
import { syncStudio, syncClient, syncClientStats } from '../controllers/internal.controller';
import { internalAuth } from '../middleware/internal.middleware';

const router = Router();

router.post('/studios/sync', internalAuth, syncStudio);
router.post('/clients/sync', internalAuth, syncClient);
router.post('/clients/stats', internalAuth, syncClientStats);

export default router;
