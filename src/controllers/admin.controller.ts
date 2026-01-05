import { Response } from 'express';
import { pool } from '../lib/db';
import { AuthRequest } from '../middleware/auth.middleware';
import cloudinary from '../lib/cloudinary';
import { asyncHandler } from '../middleware/async-handler';
import { AppError } from '../lib/errors';
import { success } from '../lib/http';

async function getStatusTimestampColumn(): Promise<'status_updated_at' | 'created_at'> {
    const res = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'status_updated_at') AS \"exists\""
    );
    return res.rows[0]?.exists ? 'status_updated_at' : 'created_at';
}

/**
 * @swagger
 * /api/admin/storage:
 *   get:
 *     summary: Get storage statistics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 */
export const getStorageStats = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
        throw new AppError('Forbidden', 403);
    }

    // Detect if photos.size column exists to avoid failing on missing column
    const sizeColumnRes = await pool.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'photos' AND column_name = 'size') AS \"exists\""
    );
    const hasSizeColumn = Boolean(sizeColumnRes.rows[0]?.exists);

    const statusTimestampColumn = await getStatusTimestampColumn();

    // 1. Database Stats (counts + optional bytes)
    const photosCountRes = await pool.query(
        hasSizeColumn
            ? 'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as size FROM photos'
            : 'SELECT COUNT(*) as count FROM photos'
    );
    const totalPhotos = parseInt(photosCountRes.rows[0].count || '0', 10);
    const dbTotalBytes = hasSizeColumn
        ? parseInt(photosCountRes.rows[0].size || '0', 10)
        : 0;

    // 2. Client Stats (Archived/Deleted breakdown + per-client totals)
    const clientsRes = await pool.query(
        `
        SELECT 
            c.id, 
            c.name, 
            c.status, 
            COALESCE(c.${statusTimestampColumn}, c.created_at) as "statusUpdatedAt",
            COUNT(p.id) as photo_count
            ${hasSizeColumn ? ', COALESCE(SUM(p.size), 0) as total_bytes' : ', 0::bigint as total_bytes'}
        FROM clients c
        LEFT JOIN photos p ON c.id = p.client_id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    `
    );
    const clients = clientsRes.rows;

    // Aggregate archived/deleted bytes if size column exists
    let statusStats = {
        archived_bytes: 0,
        deleted_bytes: 0,
    };

    if (hasSizeColumn) {
        const statusAggRes = await pool.query(
            `
            SELECT c.status, COALESCE(SUM(p.size), 0) as bytes
            FROM clients c
            LEFT JOIN photos p ON p.client_id = c.id
            GROUP BY c.status
        `
        );

        statusAggRes.rows.forEach((row) => {
            if (row.status === 'ARCHIVED') {
                statusStats.archived_bytes = parseInt(row.bytes || '0', 10);
            }
            if (row.status === 'DELETED' || row.status === 'DELETED_FOREVER') {
                statusStats.deleted_bytes += parseInt(row.bytes || '0', 10);
            }
        });
    }

    // 3. Cloudinary Stats
    let cloudinaryStats = null;
    try {
        const usage = await cloudinary.api.usage();
        cloudinaryStats = usage;
    } catch (e: any) {
        console.error('Cloudinary usage error:', e);
        cloudinaryStats = { error: e.message };
    }

    success(res, {
        totalPhotos,
        totalBytes: dbTotalBytes, // unlikely to be accurate without column
        statusStats,
        clients,
        cloudinary: cloudinaryStats
    });
});

/**
 * @swagger
 * /api/admin/lifecycle/cleanup:
 *   post:
 *     summary: Run lifecycle cleanup (Recycle Bin/Archive)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 */
export const runCleanup = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user || !['SUPER_ADMIN', 'SUPER_ADMIN_MAX'].includes(req.user.role)) {
        throw new AppError('Forbidden', 403);
    }

    const statusTimestampColumn = await getStatusTimestampColumn();

        // Logic:
        // 1. Recycle Bin (DELETED) > 7 days -> DELETED_FOREVER
        // 2. Archive (ARCHIVED) > 30 days -> DELETED (Recycle Bin)

        // Find ARCHIVED > 30 days
        const archiveThreshold = new Date();
        archiveThreshold.setDate(archiveThreshold.getDate() - 30);

        const toRecycle = await pool.query(
            `SELECT id FROM clients WHERE status = 'ARCHIVED' AND ${statusTimestampColumn} < $1`,
            [archiveThreshold]
        );

        for (const row of toRecycle.rows) {
            await pool.query(
                `UPDATE clients SET status = 'DELETED', ${statusTimestampColumn} = NOW() WHERE id = $1`,
                [row.id]
            );
        }

        // Find DELETED > 7 days
        const deleteThreshold = new Date();
        deleteThreshold.setDate(deleteThreshold.getDate() - 7);

        const toDelete = await pool.query(
            `SELECT id FROM clients WHERE status = 'DELETED' AND ${statusTimestampColumn} < $1`,
            [deleteThreshold]
        );

        // Permanently Delete
        // Need to delete photos from Cloudinary first?
        // Yes, reusing delete logic would be best, but for now let's just do it inline or call controller
        // Ideally we should import deleteClient logic, but `deleteClient` is based on req/res.
        // Let's implement basic deletion here:

        for (const row of toDelete.rows) {
            const photos = await pool.query('SELECT public_id FROM photos WHERE client_id = $1', [row.id]);
            const publicIds = photos.rows.map(p => p.public_id).filter(Boolean);

            if (publicIds.length > 0) {
                // Batch delete from Cloudinary
                // Cloudinary api.delete_resources supports up to 100/1000? 
                // Let's do snippets. 
                const chunks = [];
                for (let i = 0; i < publicIds.length; i += 100) {
                    chunks.push(publicIds.slice(i, i + 100));
                }
                for (const chunk of chunks) {
                    await cloudinary.api.delete_resources(chunk);
                }
            }

            await pool.query('DELETE FROM photos WHERE client_id = $1', [row.id]);
            await pool.query('DELETE FROM clients WHERE id = $1', [row.id]);
        }

    success(res, {
        success: true,
        archivedMoved: toRecycle.rowCount,
        permanentlyDeleted: toDelete.rowCount
    });
});
