import { Response, Request } from 'express';
import { pool } from '../lib/db';
import archiver from 'archiver';
import https from 'https';

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
export async function getGallery(req: Request, res: Response): Promise<void> {
    try {
        const { slug } = req.params;

        // Fetch client
        const clientResult = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);

        if (clientResult.rows.length === 0) {
            res.status(404).json({ error: 'Client not found' });
            return;
        }

        const client = clientResult.rows[0];

        // Fetch photos
        const photosResult = await pool.query(
            'SELECT id, url, filename, public_id, created_at FROM photos WHERE client_id = $1 ORDER BY created_at DESC',
            [client.id]
        );

        res.json({
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
    } catch (error) {
        console.error('Error fetching gallery:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

/**
 * @swagger
 * /api/gallery/{slug}/download:
 *   get:
 *     summary: Download zip of gallery
 *     tags: [Gallery]
 */
export async function downloadGallery(req: Request, res: Response): Promise<void> {
    try {
        const { slug } = req.params;

        // Find client
        const clientRes = await pool.query('SELECT * FROM clients WHERE slug = $1', [slug]);
        if (clientRes.rows.length === 0) {
            res.status(404).json({ error: 'Gallery not found' });
            return;
        }
        const client = clientRes.rows[0];

        // Get all photos
        const photosRes = await pool.query('SELECT * FROM photos WHERE client_id = $1', [client.id]);
        const photos = photosRes.rows;

        if (!photos.length) {
            res.status(400).json({ error: 'No photos to download' });
            return;
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

        await archive.finalize();

    } catch (error) {
        console.error('Download gallery error:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
    }
}

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
