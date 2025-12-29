// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import app from './app';

// For Vercel serverless functions, export the app as handler
export default app;

// For local development, start the server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
        console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    });
}
