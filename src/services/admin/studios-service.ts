import { pool } from '../../lib/db';
import { AppError } from '../../lib/errors';

export async function listStudios() {
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
  return rows;
}

export async function getStudio(studioId: string) {
  const studioRes = await pool.query(
    `SELECT id, name, slug, status, plan, created_at
     FROM studios WHERE id = $1`,
    [studioId]
  );

  if (studioRes.rows.length === 0) {
    throw new AppError('Studio not found', 404);
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

  return {
    studio: studioRes.rows[0],
    stats: statsRes.rows[0] || { photo_count: 0, storage_bytes: 0, client_count: 0 },
    owners: ownersRes.rows,
  };
}

export async function listStudioClients(studioId: string) {
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
  return rows;
}

export async function getStudioClient(studioId: string, clientId: string) {
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
    throw new AppError('Client not found', 404);
  }

  return rows[0];
}
