import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler.middleware';
import clientsRoutes from './routes/clients.routes';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import adminRoutes from './routes/admin.routes';
import internalRoutes from './routes/internal.routes';
import photosRoutes from './routes/photos.routes';
import galleryRoutes from './routes/gallery.routes';

// Environment variables are loaded in server.ts before this file is imported

const app: Application = express();

// CORS configuration - support multiple origins
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        // Explicit FRONTEND_URL takes priority
        if (process.env.FRONTEND_URL) {
            const allowedUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
            if (allowedUrls.includes(origin)) {
                return callback(null, true);
            }
        }
        
        // Allow localhost for development
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }
        
        // In production/Vercel, allow Vercel domains
        if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
            // Allow any *.vercel.app domain (for preview deployments and production)
            if (origin.includes('.vercel.app')) {
                return callback(null, true);
            }
            
            // Also allow explicit production frontend URL if set
            // You can set FRONTEND_URL in Vercel dashboard: https://photolibrary.vercel.app
        }
        
        // Default: allow in development, block in production
        if (process.env.NODE_ENV === 'production') {
            console.warn(`CORS: Blocked origin ${origin}`);
            callback(new Error('Not allowed by CORS'));
        } else {
            callback(null, true);
        }
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve custom theme switcher script
app.get('/api-docs/theme.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        window.addEventListener('load', function() {
            const btn = document.createElement('button');
            btn.innerHTML = '🌙';
            btn.style.cssText = 'position: fixed; top: 10px; right: 20px; z-index: 10000; padding: 8px 12px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: all 0.3s;';
            btn.onmouseover = function() { this.style.opacity = '0.9'; };
            
            function updateTheme() {
                const isDark = document.body.classList.contains('dark-mode');
                btn.innerHTML = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
                btn.style.background = isDark ? '#fff' : '#1a1a1a';
                btn.style.color = isDark ? '#1a1a1a' : '#fff';
                btn.style.borderColor = isDark ? '#ccc' : '#555';
            }

            btn.onclick = function() {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('swagger-theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
                updateTheme();
            };
            
            document.body.appendChild(btn);
            
            // Init
            if (localStorage.getItem('swagger-theme') === 'dark') {
                document.body.classList.add('dark-mode');
            }
            updateTheme();
        });
    `);
});

// Swagger documentation
const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      
      /* Dark Mode Styles */
      body.dark-mode, .dark-mode .swagger-ui { background-color: #1a1a1a; color: #e0e0e0; }
      .dark-mode .swagger-ui .info .title, .dark-mode .swagger-ui .info h1, .dark-mode .swagger-ui .info h2, .dark-mode .swagger-ui .info h3, .dark-mode .swagger-ui .info h4, .dark-mode .swagger-ui .info h5 { color: #fff; }
      .dark-mode .swagger-ui .opblock .opblock-summary-operation-id, .dark-mode .swagger-ui .opblock .opblock-summary-path, .dark-mode .swagger-ui .opblock .opblock-summary-path__deprecated { color: #fff; }
      .dark-mode .swagger-ui .opblock-tag { color: #fff; }
      .dark-mode .swagger-ui .scheme-container { background-color: #2a2a2a; box-shadow: none; border-bottom: 1px solid #333; }
      .dark-mode .swagger-ui .opblock .opblock-section-header { background-color: #2a2a2a; color: #e0e0e0; }
      .dark-mode .swagger-ui .tab li { color: #e0e0e0; }
      .dark-mode .swagger-ui .response-col_status { color: #e0e0e0; }
      .dark-mode .swagger-ui table thead tr td, .dark-mode .swagger-ui table thead tr th { color: #e0e0e0; border-bottom: 1px solid #333; }
      .dark-mode .swagger-ui .parameter__name { color: #e0e0e0; }
      .dark-mode .swagger-ui .parameter__type { color: #aaa; }
      .dark-mode .swagger-ui select { color: #000; }
      .dark-mode .swagger-ui input, .dark-mode .swagger-ui textarea { background-color: #333; color: #fff; border: 1px solid #444; }
      .dark-mode .swagger-ui .model { color: #e0e0e0; }
      .dark-mode .swagger-ui .prop-type { color: #9cdcfe; }
      .dark-mode .swagger-ui .prop-format { color: #aaa; }
      .dark-mode .swagger-ui .model-title { color: #e0e0e0; }
    `,
    customSiteTitle: 'PhotoLibrary API Documentation',
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui.min.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.18.2/swagger-ui-standalone-preset.min.js',
        '/api-docs/theme.js'
    ],
    swaggerOptions: {
        url: '/api-docs.json'
    }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// API routes
app.use('/api', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api', photosRoutes);
app.use('/api', galleryRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const dynamicSpec = getDynamicSwaggerSpec(req);
    res.send(dynamicSpec);
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
