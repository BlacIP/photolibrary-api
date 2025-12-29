# PhotoLibrary API

Backend API for PhotoLibrary application with Swagger documentation.

## Features

- ✅ RESTful API with Express.js + TypeScript
- ✅ Swagger/OpenAPI documentation
- ✅ JWT authentication (cookies + Bearer token)
- ✅ PostgreSQL database (Neon)
- ✅ Cloudinary integration
- ✅ Environment-based configuration (dev/prod)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Neon)
- Cloudinary account

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your credentials
```

### Development

```bash
# Run development server with hot reload
npm run dev

# Server will start on http://localhost:3001
# Swagger docs: http://localhost:3001/api-docs
```

### Build

```bash
# Compile TypeScript to JavaScript
npm run build

# Run production build
npm start
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI JSON**: http://localhost:3001/api-docs.json

## Project Structure

```
src/
├── config/          # Configuration files (Swagger)
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── routes/          # API routes
├── lib/            # Shared utilities (db, auth, cloudinary)
├── app.ts          # Express app setup
└── server.ts       # Server entry point
```

## Environment Variables

See `.env` file for required environment variables:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3001)
- `POSTGRES_URL` - PostgreSQL connection string
- `CLOUDINARY_URL` - Cloudinary connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Clients
- `GET /api/clients` - Get all clients
- `GET /api/clients/:id` - Get client by ID
- `POST /api/clients` - Create new client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Photos
- `POST /api/photos/upload-signature` - Get Cloudinary upload signature
- `POST /api/photos/save-record` - Save photo record after upload
- `DELETE /api/photos/:id` - Delete photo

### Gallery (Public)
- `GET /api/gallery/:slug` - Get public gallery
- `GET /api/gallery/:slug/download` - Download all photos as ZIP

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`

## License

ISC
