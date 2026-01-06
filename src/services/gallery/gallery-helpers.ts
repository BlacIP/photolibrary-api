import https from 'https';
import http, { type IncomingMessage } from 'http';

function getStudioApiConfig() {
  const baseUrl = process.env.STUDIO_API_URL || 'http://localhost:4000';
  const secret = process.env.ADMIN_SYNC_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

export async function callStudioApi(path: string) {
  const cfg = getStudioApiConfig();
  if (!cfg) {
    throw new Error('Studio API config missing');
  }

  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = cfg.baseUrl.endsWith('/') ? cfg.baseUrl : `${cfg.baseUrl}/`;
  const url = new URL(trimmedPath, baseUrl).toString();

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-admin-sync-secret': cfg.secret,
    },
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Studio API error (${res.status}): ${body}`);
  }

  return res.json();
}

export function fetchImageStream(url: string, attempt = 1): Promise<IncomingMessage | null> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, (response: IncomingMessage) => {
      const statusCode = response.statusCode ?? 0;
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        if (attempt > 3) {
          console.error(`Too many redirects for ${url}`);
          resolve(null);
          return;
        }
        const redirectUrl = response.headers.location;
        return resolve(fetchImageStream(redirectUrl, attempt + 1));
      }

      if (statusCode === 200) {
        resolve(response);
        return;
      }

      if (statusCode === 404 && url.includes('/upload/v')) {
        const urlWithoutVersion = url.replace(/\/upload\/v\d+\//, '/upload/');
        console.log(`Retrying 404 URL without version: ${urlWithoutVersion}`);
        return resolve(fetchImageStream(urlWithoutVersion, attempt + 1));
      }

      response.resume();
      console.error(`Failed to fetch: ${statusCode} ${url}`);
      resolve(null);
    });

    req.on('error', (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Request error';
      console.error(`Request error: ${message} ${url}`);
      resolve(null);
    });
  });
}
