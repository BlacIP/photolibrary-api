import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

function getStudioApiConfig() {
  const baseUrl = process.env.STUDIO_API_URL || 'http://localhost:4000';
  const secret = process.env.ADMIN_SYNC_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function callStudioApi(method: string, path: string, payload?: unknown) {
  const cfg = getStudioApiConfig();
  if (!cfg) {
    throw new Error('Studio API config missing');
  }

  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : `${cfg.baseUrl}/`;
  const url = new URL(trimmedPath, baseUrl).toString();

  const headers: Record<string, string> = {
    'x-admin-sync-secret': cfg.secret,
  };

  let body: string | undefined;
  if (payload !== undefined && method !== 'GET') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(payload);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Studio API error (${res.status}): ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function assertSuperAdminMax(req: AuthRequest) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN_MAX') {
    throw new AppError('Forbidden', 403);
  }
}

export const listLegacyClients = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const data = await callStudioApi('GET', '/api/internal/legacy/clients');
  success(res, data);
});

export const createLegacyClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const data = await callStudioApi('POST', '/api/internal/legacy/clients', req.body || {});
  success(res, data, 201);
});

export const getLegacyClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const { id } = req.params;
  const data = await callStudioApi('GET', `/api/internal/legacy/clients/${id}`);
  success(res, data);
});

export const updateLegacyClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const { id } = req.params;
  const data = await callStudioApi('PUT', `/api/internal/legacy/clients/${id}`, req.body || {});
  success(res, data);
});

export const deleteLegacyClient = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const { id } = req.params;
  const data = await callStudioApi('DELETE', `/api/internal/legacy/clients/${id}`);
  success(res, data);
});

export const getLegacyUploadSignature = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const data = await callStudioApi('POST', '/api/internal/legacy/photos/upload-signature', req.body || {});
  success(res, data);
});

export const saveLegacyPhotoRecord = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const data = await callStudioApi('POST', '/api/internal/legacy/photos/save-record', req.body || {});
  success(res, data);
});

export const saveLegacyPhotoRecords = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const data = await callStudioApi('POST', '/api/internal/legacy/photos/save-records', req.body || {});
  success(res, data);
});

export const deleteLegacyPhoto = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  assertSuperAdminMax(req);
  const { id } = req.params;
  const data = await callStudioApi('DELETE', `/api/internal/legacy/photos/${id}`);
  success(res, data);
});
