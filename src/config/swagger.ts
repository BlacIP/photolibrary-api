import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'PhotoLibrary API',
            version: '1.0.0',
            description: 'RESTful API for managing photo galleries and clients with Cloudinary integration',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: (() => {
                    // Priority: API_URL > VERCEL_URL > localhost
                    const url = process.env.API_URL || process.env.VERCEL_URL || 'http://localhost:3001';
                    // If VERCEL_URL doesn't have protocol, add https://
                    if (url === process.env.VERCEL_URL && !url.startsWith('http')) {
                        return `https://${url}`;
                    }
                    return url;
                })(),
                description: 'Default server (will be overridden by dynamic endpoint)',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token',
                },
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'admin_token',
                    description: 'JWT token in HTTP-only cookie',
                },
            },
            schemas: {
                Client: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        slug: { type: 'string' },
                        event_date: { type: 'string', format: 'date' },
                        subheading: { type: 'string', nullable: true },
                        status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
                        header_media_url: { type: 'string', nullable: true },
                        header_media_type: { type: 'string', enum: ['image', 'video'], nullable: true },
                        created_at: { type: 'string', format: 'date-time' },
                        photo_count: { type: 'integer' },
                    },
                },
                Photo: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        client_id: { type: 'string', format: 'uuid' },
                        url: { type: 'string' },
                        filename: { type: 'string' },
                        public_id: { type: 'string' },
                        uploaded_by: { type: 'string', format: 'uuid' },
                        uploaded_at: { type: 'string', format: 'date-time' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string', format: 'email' },
                        name: { type: 'string' },
                        role: { type: 'string', enum: ['SUPER_ADMIN', 'SUPER_ADMIN_MAX', 'ADMIN'] },
                        permissions: { type: 'array', items: { type: 'string' } },
                        created_at: { type: 'string', format: 'date-time' },
                    },
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' },
                    },
                },
            },
        },
        security: [
            {
                cookieAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

import path from 'path';

export const swaggerSpec = swaggerJsdoc({
    ...options,
    apis: [
        path.join(__dirname, '../routes/*.ts'),
        path.join(__dirname, '../controllers/*.ts'),
        path.join(__dirname, '../routes/*.js'),
        path.join(__dirname, '../controllers/*.js'),
    ],
});
