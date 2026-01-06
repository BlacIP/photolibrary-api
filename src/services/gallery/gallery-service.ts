import { Response } from 'express';
import archiver from 'archiver';
import { pool } from '../../lib/db';
import { AppError } from '../../lib/errors';
import { callStudioApi, fetchImageStream } from './gallery-helpers';

type GalleryPhoto = {
  id?: string;
  url?: string;
  filename?: string;
  public_id?: string;
  created_at?: string;
};

type GalleryClient = {
  id: string;
  name: string;
  slug?: string;
  event_date?: string;
  subheading?: string | null;
  status?: string;
  header_media_url?: string | null;
  header_media_type?: string | null;
};

type StudioGallery = GalleryClient & {
  photos?: GalleryPhoto[];
};

async function fetchGalleryFromDatabase(slug: string) {
  const clientResult = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);

  if (clientResult.rows.length === 0) {
    throw new AppError('Client not found', 404);
  }

  const client = clientResult.rows[0];
  const photosResult = await pool.query(
    'SELECT id, url, filename, public_id, created_at FROM photos WHERE client_id = $1 ORDER BY created_at DESC',
    [client.id]
  );

  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    event_date: client.event_date,
    subheading: client.subheading,
    status: client.status || 'ACTIVE',
    header_media_url: client.header_media_url,
    header_media_type: client.header_media_type,
    photos: photosResult.rows,
  } as StudioGallery;
}

export async function getGalleryPayload(slug: string) {
  try {
    const studioGallery = (await callStudioApi(`/api/internal/legacy/gallery/${slug}`)) as StudioGallery | null;
    if (studioGallery) {
      return studioGallery;
    }
  } catch (error) {
    console.warn('Studio gallery lookup failed, falling back to legacy DB', error);
  }

  return fetchGalleryFromDatabase(slug);
}

export async function getGalleryDownloadPayload(slug: string) {
  let client: GalleryClient | null = null;
  let photos: GalleryPhoto[] = [];

  try {
    const studioGallery = (await callStudioApi(`/api/internal/legacy/gallery/${slug}`)) as StudioGallery | null;
    if (studioGallery) {
      client = studioGallery;
      photos = Array.isArray(studioGallery.photos) ? studioGallery.photos : [];
    }
  } catch (error) {
    console.warn('Studio gallery lookup failed, falling back to legacy DB', error);
  }

  if (!client) {
    const clientRes = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);
    if (clientRes.rows.length === 0) {
      throw new AppError('Gallery not found', 404);
    }
    client = clientRes.rows[0] as GalleryClient;
    const photosRes = await pool.query('SELECT * FROM photos WHERE client_id = $1', [client.id]);
    photos = photosRes.rows as GalleryPhoto[];
  }

  if (!photos.length) {
    throw new AppError('No photos to download', 400);
  }

  return { client, photos };
}

export async function streamGalleryDownload(client: GalleryClient, photos: GalleryPhoto[], res: Response) {
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const filename = `${client.name.replace(/[^a-z0-9]/gi, '_')}_Gallery.zip`;
  res.attachment(filename);

  archive.pipe(res);

  for (const photo of photos) {
    if (!photo.url) continue;
    const photoUrl = photo.url;
    const filename = resolveDownloadFilename(photo);

    try {
      await new Promise<void>((resolve) => {
        fetchImageStream(photoUrl)
          .then((stream) => {
            if (stream) {
              archive.append(stream, { name: filename });
              stream.on('end', () => resolve());
              stream.on('error', (err: unknown) => {
                console.error(`Stream error for ${photoUrl}:`, err);
                resolve();
              });
            } else {
              console.error(`Failed to fetch image: ${photoUrl}`);
              resolve();
            }
          })
          .catch((err) => {
            console.error(`Fetch error for ${photoUrl}:`, err);
            resolve();
          });
      });
    } catch (err) {
      console.error(`Processing error for photo ${photo.id}:`, err);
    }
  }

  try {
    await archive.finalize();
  } catch (error) {
    console.error('Download gallery error:', error);
  }
}

function resolveDownloadFilename(photo: {
  filename?: string | null;
  url?: string | null;
  public_id?: string | null;
  id?: string | null;
}) {
  const directName = normalizeFilename(photo.filename);
  if (directName) return directName;

  const urlName = normalizeFilename(extractFilenameFromUrl(photo.url));
  if (urlName) return urlName;

  if (photo.public_id) {
    const base = photo.public_id.split('/').pop() || photo.public_id;
    return base;
  }

  return `photo_${photo.id || 'image'}.jpg`;
}

function extractFilenameFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop();
    return lastSegment ? decodeURIComponent(lastSegment) : null;
  } catch {
    const sanitized = url.split('?')[0];
    const lastSegment = sanitized.split('/').pop();
    return lastSegment ? decodeURIComponent(lastSegment) : null;
  }
}

function normalizeFilename(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
