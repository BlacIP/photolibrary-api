import { randomUUID } from 'crypto';
import { pool } from '../../lib/db';
import { signUploadRequest } from '../../lib/cloudinary';
import cloudinary from '../../lib/cloudinary';
import { AppError } from '../../lib/errors';

function getCloudinaryKeys() {
  const cfg = cloudinary.config();
  const cloudName =
    cfg.cloud_name ||
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_URL?.split('@')[1];
  const apiKey =
    cfg.api_key ||
    process.env.CLOUDINARY_API_KEY ||
    process.env.CLOUDINARY_URL?.split(':')[1]?.split('@')[0];

  return { cloudName, apiKey };
}

export async function getUploadSignaturePayload(clientId: string) {
  const clientCheck = await pool.query('SELECT id FROM clients WHERE id = $1', [clientId]);
  if (clientCheck.rows.length === 0) {
    throw new AppError('Client not found', 404);
  }

  const { timestamp, signature, folder } = await signUploadRequest(clientId);
  const { cloudName, apiKey } = getCloudinaryKeys();

  return {
    timestamp,
    signature,
    folder,
    cloudName,
    apiKey,
    cloud_name: cloudName,
    api_key: apiKey,
  };
}

export async function savePhotoRecord({
  clientId,
  publicId,
  url,
  filename,
}: {
  clientId: string;
  publicId: string;
  url: string;
  filename?: string;
}) {
  const resolvedFilename = resolveFilename(filename, publicId);
  await pool.query(
    'INSERT INTO photos (id, client_id, url, filename, public_id) VALUES ($1, $2, $3, $4, $5)',
    [randomUUID(), clientId, url, resolvedFilename, publicId]
  );

  return { success: true };
}

function resolveFilename(filename: string | undefined, publicId: string) {
  const trimmed = filename?.trim();
  if (trimmed) return trimmed;
  return publicId.split('/').pop() || 'uploaded_file';
}

export async function deletePhotoRecord(id: string) {
  const photoResult = await pool.query('SELECT public_id FROM photos WHERE id = $1', [id]);

  if (photoResult.rows.length === 0) {
    throw new AppError('Photo not found', 404);
  }

  const photo = photoResult.rows[0];

  try {
    await cloudinary.uploader.destroy(photo.public_id);
    console.log(`Deleted from Cloudinary: ${photo.public_id}`);
  } catch (cloudinaryError) {
    console.error(`Failed to delete from Cloudinary: ${photo.public_id}`, cloudinaryError);
  }

  await pool.query('DELETE FROM photos WHERE id = $1', [id]);

  return { success: true };
}
