import { randomUUID } from 'crypto';
import { pool } from '../../lib/db';
import cloudinary from '../../lib/cloudinary';
import { AppError } from '../../lib/errors';

type ClientUpdateInput = {
  header_media_url?: string | null;
  header_media_type?: string | null;
  status?: string;
  name?: string;
  subheading?: string | null;
  event_date?: string | null;
};

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function listClients() {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(p.id) as photo_count 
     FROM clients c
     LEFT JOIN photos p ON c.id = p.client_id
     GROUP BY c.id
     ORDER BY c.created_at DESC`
  );

  return rows;
}

export async function createClient({
  name,
  subheading,
  eventDate,
}: {
  name: string;
  subheading?: string | null;
  eventDate: string;
}) {
  const slug = slugify(name);
  const id = randomUUID();
  const insertQuery = `
    INSERT INTO clients (id, name, slug, subheading, event_date, status)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    RETURNING id, name, slug, subheading, event_date, status
  `;

  const { rows } = await pool.query(insertQuery, [id, name, slug, subheading || null, eventDate]);
  return rows[0];
}

export async function getClientDetails(id: string) {
  const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
  if (clientResult.rows.length === 0) {
    throw new AppError('Client not found', 404);
  }

  const photosResult = await pool.query(
    'SELECT id, url, filename, public_id, created_at FROM photos WHERE client_id = $1 ORDER BY created_at DESC LIMIT 500',
    [id]
  );

  return {
    client: clientResult.rows[0],
    photos: photosResult.rows,
  };
}

export async function updateClient(id: string, body: ClientUpdateInput) {
  const updates: string[] = [];
  const values: Array<string | number | null> = [];
  let paramIndex = 1;

  if (body.header_media_url !== undefined) {
    updates.push(`header_media_url = $${paramIndex++}`);
    values.push(body.header_media_url);
  }
  if (body.header_media_type !== undefined) {
    updates.push(`header_media_type = $${paramIndex++}`);
    values.push(body.header_media_type);
  }
  if (body.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(body.status);
    updates.push(`status_updated_at = NOW()`);
  }
  if (body.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(body.name);

    const slug = slugify(body.name);
    updates.push(`slug = $${paramIndex++}`);
    values.push(slug);
  }
  if (body.subheading !== undefined) {
    updates.push(`subheading = $${paramIndex++}`);
    values.push(body.subheading);
  }
  if (body.event_date !== undefined) {
    updates.push(`event_date = $${paramIndex++}`);
    values.push(body.event_date);
  }

  if (updates.length > 0) {
    values.push(id);
    const query = `UPDATE clients SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
    await pool.query(query, values);
  }

  return { success: true };
}

export async function deleteClient(id: string) {
  const photosResult = await pool.query('SELECT public_id FROM photos WHERE client_id = $1', [id]);

  if (photosResult.rows.length > 0) {
    for (const photo of photosResult.rows) {
      try {
        await cloudinary.uploader.destroy(photo.public_id);
      } catch (e) {
        console.error(`Failed to delete Cloudinary image: ${photo.public_id}`, e);
      }
    }
  }

  await pool.query('DELETE FROM photos WHERE client_id = $1', [id]);
  await pool.query('DELETE FROM clients WHERE id = $1', [id]);

  return { success: true };
}
