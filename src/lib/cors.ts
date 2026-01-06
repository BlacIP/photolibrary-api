import type { CorsOptions } from 'cors';

export function createCorsConfig() {
  const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';
  const normalizeOrigin = (value: string) => value.replace(/\/$/, '');
  const toOrigin = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const allowedOrigins = new Set<string>();
  const originEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
  [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    process.env.API_URL,
    process.env.PRODUCTION_URL,
    process.env.VERCEL_URL,
    ...originEnv.split(','),
  ]
    .filter(Boolean)
    .map((value) => toOrigin(String(value)))
    .filter(Boolean)
    .forEach((value) => allowedOrigins.add(normalizeOrigin(value)));

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.has(normalized)) {
        return callback(null, true);
      }

      if (allowVercelPreviews && normalized.endsWith('.vercel.app')) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV === 'production') {
        console.warn(`CORS: Blocked origin ${origin}`);
        callback(new Error('Not allowed by CORS'));
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  };

  return { corsOptions, allowedOrigins, normalizeOrigin, allowVercelPreviews };
}
