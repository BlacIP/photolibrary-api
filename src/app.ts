import express, { Application } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { swaggerSpec } from './config/swagger';
import { swaggerThemeScript, swaggerUiOptions } from './config/swagger-ui';
import { errorHandler } from './middleware/errorHandler.middleware';
import clientsRoutes from './routes/clients.routes';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import adminRoutes from './routes/admin.routes';
import internalRoutes from './routes/internal.routes';
import photosRoutes from './routes/photos.routes';
import galleryRoutes from './routes/gallery.routes';
import { createCorsConfig } from './lib/cors';
import { healthHandler } from './lib/health';

// Environment variables are loaded in server.ts before this file is imported

const app: Application = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
    })
);

const { corsOptions, allowedOrigins, normalizeOrigin, allowVercelPreviews } = createCorsConfig();
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    if (req.headers['x-admin-sync-secret']) {
        return next();
    }

    let origin = req.headers.origin as string | undefined;
    if (!origin && req.headers.referer) {
        try {
            origin = new URL(req.headers.referer).origin;
        } catch {
            origin = undefined;
        }
    }

    if (!origin) {
        return next();
    }

    const normalized = normalizeOrigin(origin);
    if (allowedOrigins.has(normalized)) {
        return next();
    }

    if (allowVercelPreviews && normalized.endsWith('.vercel.app')) {
        return next();
    }

    res.status(403).json({ error: 'Forbidden - CSRF protection' });
});

const enableRequestLogging =
    process.env.REQUEST_LOGS === 'true' || process.env.NODE_ENV !== 'production';
if (enableRequestLogging) {
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const ms = Date.now() - start;
            const user = (req as { user?: { id?: string; role?: string } }).user;
            const actor = user ? ` user=${user.id} role=${user.role}` : '';
            console.log(`[${res.statusCode}] ${req.method} ${req.originalUrl} ${ms}ms${actor}`);
        });
        next();
    });
}

const enableSwagger = process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production';

// Serve custom theme switcher script
if (enableSwagger) {
    app.get('/api-docs/theme.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.send(swaggerThemeScript);
    });
}

if (enableSwagger) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

// API routes
app.use('/api', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api', photosRoutes);
app.use('/api', galleryRoutes);

// Health check
app.get('/health', healthHandler);

// Helper function to generate dynamic swagger spec with current server URL
function getDynamicSwaggerSpec(req: express.Request) {
    // Detect protocol (Vercel uses x-forwarded-proto header)
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    
    // Get host from request
    const requestHost = req.get('host') || req.headers.host || 'localhost:3001';
    
    // Determine the base URL to use
    let baseUrl: string;
    
    // Priority 1: Use explicit API_URL or PRODUCTION_URL environment variable
    if (process.env.API_URL || process.env.PRODUCTION_URL) {
        baseUrl = process.env.API_URL || process.env.PRODUCTION_URL || '';
        // Ensure it has protocol
        if (!baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
        }
    }
    // Priority 2: If on Vercel preview deployment, use production URL
    else if (requestHost.includes('vercel.app') && requestHost !== 'photolibrary-api.vercel.app') {
        // This is a preview deployment, use production URL
        baseUrl = 'https://photolibrary-api.vercel.app';
    }
    // Priority 3: Use current request host (for localhost or production)
    else {
        baseUrl = `${protocol}://${requestHost}`;
    }
    
    // Clone the swagger spec and update servers
    const dynamicSpec = JSON.parse(JSON.stringify(swaggerSpec));
    
    // Update servers array with dynamic URL
    dynamicSpec.servers = [
        {
            url: baseUrl,
            description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Current server',
        },
    ];
    
    return dynamicSpec;
}

// Swagger JSON endpoint
if (enableSwagger) {
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        const dynamicSpec = getDynamicSwaggerSpec(req);
        res.send(dynamicSpec);
    });
}

// Error handler (must be last)
app.use(errorHandler);

export default app;
