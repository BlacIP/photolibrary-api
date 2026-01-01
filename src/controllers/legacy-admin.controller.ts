import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

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

function ensureSuperAdminMax(req: AuthRequest, res: Response): boolean {
  if (!req.user || req.user.role !== 'SUPER_ADMIN_MAX') {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

export async function listLegacyClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const data = await callStudioApi('GET', '/api/internal/legacy/clients');
    res.json(data);
  } catch (error) {
    console.error('Legacy clients list error:', error);
    res.status(500).json({ error: 'Failed to fetch legacy clients' });
  }
}

export async function createLegacyClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const data = await callStudioApi('POST', '/api/internal/legacy/clients', req.body || {});
    res.status(201).json(data);
  } catch (error) {
    console.error('Legacy client create error:', error);
    res.status(500).json({ error: 'Failed to create legacy client' });
  }
}

export async function getLegacyClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const { id } = req.params;
    const data = await callStudioApi('GET', `/api/internal/legacy/clients/${id}`);
    res.json(data);
  } catch (error) {
    console.error('Legacy client get error:', error);
    res.status(500).json({ error: 'Failed to fetch legacy client' });
  }
}

export async function updateLegacyClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const { id } = req.params;
    const data = await callStudioApi('PUT', `/api/internal/legacy/clients/${id}`, req.body || {});
    res.json(data);
  } catch (error) {
    console.error('Legacy client update error:', error);
    res.status(500).json({ error: 'Failed to update legacy client' });
  }
}

export async function deleteLegacyClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const { id } = req.params;
    const data = await callStudioApi('DELETE', `/api/internal/legacy/clients/${id}`);
    res.json(data);
  } catch (error) {
    console.error('Legacy client delete error:', error);
    res.status(500).json({ error: 'Failed to delete legacy client' });
  }
}

export async function getLegacyUploadSignature(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const data = await callStudioApi('POST', '/api/internal/legacy/photos/upload-signature', req.body || {});
    res.json(data);
  } catch (error) {
    console.error('Legacy upload signature error:', error);
    res.status(500).json({ error: 'Failed to generate upload signature' });
  }
}

export async function saveLegacyPhotoRecord(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const data = await callStudioApi('POST', '/api/internal/legacy/photos/save-record', req.body || {});
    res.json(data);
  } catch (error) {
    console.error('Legacy save photo error:', error);
    res.status(500).json({ error: 'Failed to save photo record' });
  }
}

export async function saveLegacyPhotoRecords(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const data = await callStudioApi('POST', '/api/internal/legacy/photos/save-records', req.body || {});
    res.json(data);
  } catch (error) {
    console.error('Legacy save photo records error:', error);
    res.status(500).json({ error: 'Failed to save photo records' });
  }
}

export async function deleteLegacyPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdminMax(req, res)) return;
    const { id } = req.params;
    const data = await callStudioApi('DELETE', `/api/internal/legacy/photos/${id}`);
    res.json(data);
  } catch (error) {
    console.error('Legacy delete photo error:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
}
