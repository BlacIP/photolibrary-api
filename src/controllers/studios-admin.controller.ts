import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';
import {
  getStudio as getStudioService,
  getStudioClient as getStudioClientService,
  listStudioClients as listStudioClientsService,
  listStudios as listStudiosService,
} from '../services/admin/studios-service';
import { updateStudioStatus as updateStudioStatusService } from '../services/admin/studio-status';

function assertSuperAdmin(req: AuthRequest) {
  if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
    throw new AppError('Forbidden', 403);
  }
}

export const listStudios = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const rows = await listStudiosService();
  success(res, rows);
});

export const getStudio = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const result = await getStudioService(req.params.studioId);
  success(res, result);
});

export const listStudioClients = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const rows = await listStudioClientsService(req.params.studioId);
  success(res, rows);
});

export const getStudioClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const result = await getStudioClientService(req.params.studioId, req.params.clientId);
  success(res, result);
});

export const updateStudioStatus = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdmin(req);
  const response = await updateStudioStatusService(req.params.studioId, req.body?.status);
  success(res, response);
});
