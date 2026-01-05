import { Response, Request } from 'express';
import { pool } from '../lib/db';
import archiver from 'archiver';
import https from 'https';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

type StudioGallery = {
    id?: string;
    name?: string;
    slug?: string;
    event_date?: string;
    subheading?: string | null;
    status?: string;
    header_media_url?: string | null;
    header_media_type?: string | null;
    photos?: Array<{
        id?: string;
        url?: string;
        filename?: string;
        public_id?: string;
        created_at?: string;
    }>;
};

function getStudioApiConfig() {
    const baseUrl = process.env.STUDIO_API_URL || 'http://localhost:4000';
    const secret = process.env.ADMIN_SYNC_SECRET;
    if (!baseUrl || !secret) return null;
    return { baseUrl, secret };
}

async function callStudioApi(path: string) {
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

/**
 * @swagger
 * /api/gallery/{slug}:
 *   get:
 *     summary: Get public gallery
 *     description: Get client gallery by slug (public endpoint, no auth required)
 *     tags: [Gallery]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gallery data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 slug:
 *                   type: string
 *                 event_date:
 *                   type: string
 *                 subheading:
 *                   type: string
 *                 header_media_url:
 *                   type: string
 *                 header_media_type:
 *                   type: string
 *                 photos:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Gallery not found
 */
export const getGallery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    // Try studio-api legacy gallery first.
    try {
        const studioGallery = (await callStudioApi(`/api/internal/legacy/gallery/${slug}`)) as StudioGallery | null;
        if (studioGallery) {
            success(res, studioGallery);
            return;
        }
    } catch (error) {
        console.warn('Studio gallery lookup failed, falling back to legacy DB', error);
    }

    // Legacy DB fallback
    const clientResult = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);

    if (clientResult.rows.length === 0) {
        throw new AppError('Client not found', 404);
    }

    const client = clientResult.rows[0];

    const photosResult = await pool.query(
        'SELECT id, url, filename, public_id, created_at FROM photos WHERE client_id = $1 ORDER BY created_at DESC',
        [client.id]
    );

    success(res, {
        id: client.id,
        name: client.name,
        slug: client.slug,
        event_date: client.event_date,
        subheading: client.subheading,
        status: client.status || 'ACTIVE',
        header_media_url: client.header_media_url,
        header_media_type: client.header_media_type,
        photos: photosResult.rows,
    });
});

/**
 * @swagger
 * /api/gallery/{slug}/download:
 *   get:
 *     summary: Download zip of gallery
 *     tags: [Gallery]
 */
export const downloadGallery = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { slug } = req.params;

    // Try studio-api legacy gallery first.
    let client = null;
    let photos: any[] = [];
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
        client = clientRes.rows[0];
        const photosRes = await pool.query('SELECT * FROM photos WHERE client_id = $1', [client.id]);
        photos = photosRes.rows;
    }

    if (!photos.length) {
        throw new AppError('No photos to download', 400);
    }

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    const filename = `${client.name.replace(/[^a-z0-9]/gi, '_')}_Gallery.zip`;
    res.attachment(filename);

    archive.pipe(res);

    for (const photo of photos) {
        if (!photo.url) continue;

        try {
            await new Promise<void>((resolve, reject) => {
                fetchImageStream(photo.url)
                    .then((stream) => {
                        if (stream) {
                            archive.append(stream, { name: photo.filename || `photo_${photo.id}.jpg` });
                            stream.on('end', () => resolve());
                            stream.on('error', (err: any) => {
                                console.error(`Stream error for ${photo.url}:`, err);
                                resolve();
                            });
                        } else {
                            console.error(`Failed to fetch image: ${photo.url}`);
                            resolve();
                        }
                    })
                    .catch((err) => {
                        console.error(`Fetch error for ${photo.url}:`, err);
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
});

// Helper to fetch image stream with redirect handling and retry logic
function fetchImageStream(url: string, attempt = 1): Promise<any> {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : require('http');

        const req = protocol.get(url, (response: any) => {
            // Handle Redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Follow redirect
                if (attempt > 3) {
                    console.error(`Too many redirects for ${url}`);
                    resolve(null);
                    return;
                }
                const redirectUrl = response.headers.location;
                // Ensure redirect url is absolute or relative to host? Usually absolute.
                return resolve(fetchImageStream(redirectUrl, attempt + 1));
            }

            // Handle Success
            if (response.statusCode === 200) {
                resolve(response);
                return;
            }

            // Handle 404 - Retry without version number if present
            if (response.statusCode === 404 && url.includes('/upload/v')) {
                const urlWithoutVersion = url.replace(/\/upload\/v\d+\//, '/upload/');
                console.log(`Retrying 404 URL without version: ${urlWithoutVersion}`);
                return resolve(fetchImageStream(urlWithoutVersion, attempt + 1));
            }

            // Other errors
            response.resume(); // Consume data
            console.error(`Failed to fetch: ${response.statusCode} ${url}`);
            resolve(null);
        });

        req.on('error', (err: any) => {
            console.error(`Request error: ${err.message} ${url}`);
            resolve(null);
        });
    });
}
