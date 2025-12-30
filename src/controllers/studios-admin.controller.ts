import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';

function getStudioApiConfig() {
  const baseUrl = process.env.STUDIO_API_URL || 'http://localhost:4000';
  const secret = process.env.ADMIN_SYNC_SECRET;
  if (!baseUrl || !secret) return null;
  return { baseUrl, secret };
}

async function callStudioApi(path: string, payload: unknown) {
  const cfg = getStudioApiConfig();
  if (!cfg) {
    throw new Error('Studio API config missing');
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
    throw new Error(`Studio API error (${res.status}): ${body}`);
  }

  return res.json();
}

function ensureSuperAdmin(req: AuthRequest, res: Response): boolean {
  if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/**
 * @swagger
 * /api/admin/studios:
 *   get:
 *     summary: List studios
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 */
export async function listStudios(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdmin(req, res)) return;
    const query = `
      SELECT
        s.id,
        s.name,
        s.slug,
        s.status,
        s.plan,
        s.created_at,
        COALESCE(SUM(stats.photo_count), 0) AS photo_count,
        COALESCE(SUM(stats.storage_bytes), 0) AS storage_bytes,
        COUNT(DISTINCT sc.client_id) AS client_count
      FROM studios s
      LEFT JOIN studio_clients sc ON sc.studio_id = s.id
      LEFT JOIN studio_client_stats stats
        ON stats.studio_id = s.id AND stats.client_id = sc.client_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;

    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('List studios error:', error);
    res.status(500).json({ error: 'Failed to list studios' });
  }
}

/**
 * @swagger
 * /api/admin/studios/{studioId}:
 *   get:
 *     summary: Get studio details
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 */
export async function getStudio(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdmin(req, res)) return;
    const { studioId } = req.params;
    const studioRes = await pool.query(
      `SELECT id, name, slug, status, plan, created_at
       FROM studios WHERE id = $1`,
      [studioId]
    );

    if (studioRes.rows.length === 0) {
      res.status(404).json({ error: 'Studio not found' });
      return;
    }

    const statsRes = await pool.query(
      `SELECT
         COALESCE(SUM(stats.photo_count), 0) AS photo_count,
         COALESCE(SUM(stats.storage_bytes), 0) AS storage_bytes,
         COUNT(DISTINCT sc.client_id) AS client_count
       FROM studio_clients sc
       LEFT JOIN studio_client_stats stats
         ON stats.studio_id = sc.studio_id AND stats.client_id = sc.client_id
       WHERE sc.studio_id = $1`,
      [studioId]
    );

    const ownersRes = await pool.query(
      `SELECT owner_id AS id, email, role, auth_provider, display_name, avatar_url, created_at
       FROM studio_owners
       WHERE studio_id = $1
       ORDER BY created_at ASC`,
      [studioId]
    );

    res.json({
      studio: studioRes.rows[0],
      stats: statsRes.rows[0] || { photo_count: 0, storage_bytes: 0, client_count: 0 },
      owners: ownersRes.rows,
    });
  } catch (error) {
    console.error('Get studio error:', error);
    res.status(500).json({ error: 'Failed to fetch studio' });
  }
}

/**
 * @swagger
 * /api/admin/studios/{studioId}/clients:
 *   get:
 *     summary: List studio clients (stats only)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 */
export async function listStudioClients(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdmin(req, res)) return;
    const { studioId } = req.params;
    const query = `
      SELECT
        sc.client_id,
        sc.name,
        sc.slug,
        sc.subheading,
        sc.event_date,
        sc.status,
        sc.created_at,
        COALESCE(stats.photo_count, 0) AS photo_count,
        COALESCE(stats.storage_bytes, 0) AS storage_bytes
      FROM studio_clients sc
      LEFT JOIN studio_client_stats stats
        ON stats.studio_id = sc.studio_id AND stats.client_id = sc.client_id
      WHERE sc.studio_id = $1
      ORDER BY sc.created_at DESC
    `;

    const { rows } = await pool.query(query, [studioId]);
    res.json(rows);
  } catch (error) {
    console.error('List studio clients error:', error);
    res.status(500).json({ error: 'Failed to list studio clients' });
  }
}

/**
 * @swagger
 * /api/admin/studios/{studioId}/clients/{clientId}:
 *   get:
 *     summary: Get studio client details (stats only)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 */
export async function getStudioClient(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdmin(req, res)) return;
    const { studioId, clientId } = req.params;
    const query = `
      SELECT
        sc.client_id,
        sc.name,
        sc.slug,
        sc.subheading,
        sc.event_date,
        sc.status,
        sc.created_at,
        COALESCE(stats.photo_count, 0) AS photo_count,
        COALESCE(stats.storage_bytes, 0) AS storage_bytes
      FROM studio_clients sc
      LEFT JOIN studio_client_stats stats
        ON stats.studio_id = sc.studio_id AND stats.client_id = sc.client_id
      WHERE sc.studio_id = $1 AND sc.client_id = $2
    `;

    const { rows } = await pool.query(query, [studioId, clientId]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get studio client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
}

export async function updateStudioStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!ensureSuperAdmin(req, res)) return;
    const { studioId } = req.params;
    const { status } = req.body || {};
    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const response = await callStudioApi(`/api/internal/studios/${studioId}/status`, { status });
    res.json(response);
  } catch (error: any) {
    console.error('Update studio status error:', error);
    res.status(500).json({ error: error?.message || 'Failed to update studio status' });
  }
}

/**
 * @swagger
 * /api/admin/studios/{studioId}/status:
 *   patch:
 *     summary: Update studio status
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: studioId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, SUSPENDED, DELETED, ONBOARDING]
 */
