import { Request, Response } from 'express';
import { pool } from '../lib/db';

export async function syncStudio(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, slug, status, plan, created_at } = req.body || {};
    if (!id || !name || !slug) {
      res.status(400).json({ error: 'id, name, and slug are required' });
      return;
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
    res.json({ success: true });
  } catch (error) {
    console.error('Sync studio error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
}

export async function syncClient(req: Request, res: Response): Promise<void> {
  try {
    const { studioId, clientId, deleted } = req.body || {};
    if (!studioId || !clientId) {
      res.status(400).json({ error: 'studioId and clientId are required' });
      return;
    }

    if (deleted) {
      await pool.query('DELETE FROM studio_client_stats WHERE studio_id = $1 AND client_id = $2', [studioId, clientId]);
      await pool.query('DELETE FROM studio_clients WHERE studio_id = $1 AND client_id = $2', [studioId, clientId]);
      res.json({ success: true });
      return;
    }

    const { name, slug, subheading, event_date, status, created_at } = req.body || {};
    if (!name || !slug || !event_date) {
      res.status(400).json({ error: 'name, slug, and event_date are required' });
      return;
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

    res.json({ success: true });
  } catch (error) {
    console.error('Sync client error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
}

export async function syncClientStats(req: Request, res: Response): Promise<void> {
  try {
    const { studioId, clientId, deltaCount, deltaBytes, photoCount, storageBytes } = req.body || {};
    if (!studioId || !clientId) {
      res.status(400).json({ error: 'studioId and clientId are required' });
      return;
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
      res.json({ success: true });
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

    res.json({ success: true });
  } catch (error) {
    console.error('Sync client stats error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
}
