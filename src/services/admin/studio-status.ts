import { AppError } from '../../lib/errors';

function getStudioApiConfig() {
  const baseUrl = process.env.STUDIO_API_URL || 'http://localhost:4000';
  const secret = process.env.ADMIN_SYNC_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function callStudioApi(path: string, payload: unknown) {
  const cfg = getStudioApiConfig();
  if (!cfg) {
    throw new AppError('Studio API config missing', 500);
  }

  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : `${cfg.baseUrl}/`;
  const url = new URL(trimmedPath, baseUrl).toString();

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-admin-sync-secret': cfg.secret,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new AppError(`Studio API error (${res.status}): ${body}`, 500);
  }

  return res.json();
}

export async function updateStudioStatus(studioId: string, status: string) {
  if (!status) {
    throw new AppError('status is required', 400);
  }

  return callStudioApi(`/api/internal/studios/${studioId}/status`, { status });
}
