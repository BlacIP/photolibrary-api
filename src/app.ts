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
import photosRoutes from './routes/photos.routes';
import galleryRoutes from './routes/gallery.routes';

// Environment variables are loaded in server.ts before this file is imported

const app: Application = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PhotoLibrary API Documentation',
}));

// API routes
app.use('/api', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', photosRoutes);
app.use('/api', galleryRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
