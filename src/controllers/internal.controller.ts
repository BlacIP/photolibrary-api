import { Request, Response } from 'express';
import { pool } from '../lib/db';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

export const syncStudio = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id, name, slug, status, plan, created_at } = req.body || {};
  if (!id || !name || !slug) {
    throw new AppError('id, name, and slug are required', 400);
  }

  const query = `
      INSERT INTO studios (id, name, slug, status, plan, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        status = EXCLUDED.status,
        plan = EXCLUDED.plan,
        updated_at = NOW()
    `;
  await pool.query(query, [id, name, slug, status || 'ONBOARDING', plan || 'free', created_at || null]);
  success(res, { success: true });
});

export const syncClient = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studioId, clientId, deleted } = req.body || {};
  if (!studioId || !clientId) {
    throw new AppError('studioId and clientId are required', 400);
  }

  if (deleted) {
    await pool.query('DELETE FROM studio_client_stats WHERE studio_id = $1 AND client_id = $2', [studioId, clientId]);
    await pool.query('DELETE FROM studio_clients WHERE studio_id = $1 AND client_id = $2', [studioId, clientId]);
    success(res, { success: true });
    return;
  }

  const { name, slug, subheading, event_date, status, created_at } = req.body || {};
  if (!name || !slug || !event_date) {
    throw new AppError('name, slug, and event_date are required', 400);
  }

  const query = `
      INSERT INTO studio_clients (studio_id, client_id, name, slug, subheading, event_date, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), NOW())
      ON CONFLICT (studio_id, client_id) DO UPDATE SET
        name = EXCLUDED.name,
        slug = EXCLUDED.slug,
        subheading = EXCLUDED.subheading,
        event_date = EXCLUDED.event_date,
        status = EXCLUDED.status,
        updated_at = NOW()
    `;
  await pool.query(query, [
    studioId,
    clientId,
    name,
    slug,
    subheading || null,
    event_date,
    status || 'ACTIVE',
    created_at || null,
  ]);

  success(res, { success: true });
});

export const syncClientStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studioId, clientId, deltaCount, deltaBytes, photoCount, storageBytes } = req.body || {};
  if (!studioId || !clientId) {
    throw new AppError('studioId and clientId are required', 400);
  }

  if (photoCount !== undefined || storageBytes !== undefined) {
    const query = `
        INSERT INTO studio_client_stats (studio_id, client_id, photo_count, storage_bytes, updated_at)
        VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), NOW())
        ON CONFLICT (studio_id, client_id) DO UPDATE SET
          photo_count = COALESCE($3, studio_client_stats.photo_count),
          storage_bytes = COALESCE($4, studio_client_stats.storage_bytes),
          updated_at = NOW()
      `;
    await pool.query(query, [studioId, clientId, photoCount ?? null, storageBytes ?? null]);
    success(res, { success: true });
    return;
  }

  const countDelta = Number(deltaCount || 0);
  const bytesDelta = Number(deltaBytes || 0);

  const query = `
      INSERT INTO studio_client_stats (studio_id, client_id, photo_count, storage_bytes, updated_at)
      VALUES ($1, $2, GREATEST($3, 0), GREATEST($4, 0), NOW())
      ON CONFLICT (studio_id, client_id) DO UPDATE SET
        photo_count = GREATEST(studio_client_stats.photo_count + $3, 0),
        storage_bytes = GREATEST(studio_client_stats.storage_bytes + $4, 0),
        updated_at = NOW()
    `;
  await pool.query(query, [studioId, clientId, countDelta, bytesDelta]);

  success(res, { success: true });
});

export const syncStudioOwner = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { studioId, ownerId, deleted } = req.body || {};
  if (!studioId || !ownerId) {
    throw new AppError('studioId and ownerId are required', 400);
  }

  if (deleted) {
    await pool.query('DELETE FROM studio_owners WHERE studio_id = $1 AND owner_id = $2', [
      studioId,
      ownerId,
    ]);
    success(res, { success: true });
    return;
  }

  const { email, role, authProvider, displayName, avatarUrl, createdAt } = req.body || {};
  if (!email || !role) {
    throw new AppError('email and role are required', 400);
  }

  const query = `
      INSERT INTO studio_owners (
        studio_id, owner_id, email, role, auth_provider, display_name, avatar_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()), NOW())
      ON CONFLICT (studio_id, owner_id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        auth_provider = EXCLUDED.auth_provider,
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW()
    `;

  await pool.query(query, [
    studioId,
    ownerId,
    email,
    role,
    authProvider || 'local',
    displayName || null,
    avatarUrl || null,
    createdAt || null,
  ]);

  success(res, { success: true });
});
