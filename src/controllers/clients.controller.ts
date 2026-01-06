import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';
import {
    deleteClient as deleteClientService,
    getClientDetails,
    listClients,
    updateClient as updateClientService,
} from '../services/clients/clients-service';

export const getClients = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const rows = await listClients();
    success(res, rows);
});

export const getClientById = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const result = await getClientDetails(id);
    success(res, result);
});

export const updateClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body;

    // Permission check
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const permissions = req.user.permissions || [];
    const canEdit = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) || permissions.includes('manage_clients');

    if (!canEdit) {
        throw new AppError('Forbidden', 403);
    }

    const result = await updateClientService(id, body || {});
    success(res, result);
});

export const deleteClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Permission check
    if (!req.user) {
        throw new AppError('Unauthorized', 401);
    }

    const permissions = req.user.permissions || [];
    const canDelete = ['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role) || permissions.includes('manage_clients');

    if (!canDelete) {
        throw new AppError('Forbidden', 403);
    }

    const result = await deleteClientService(id);
    success(res, result);
});
