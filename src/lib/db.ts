import { Pool } from '@neondatabase/serverless';

// Use different database based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const connectionString = isDevelopment
    ? (process.env.DATABASE_URL_DEV || process.env.DATABASE_URL)
    : (process.env.POSTGRES_URL || process.env.DATABASE_URL);

// Debug logging
console.log('🔍 Database Configuration:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isDevelopment:', isDevelopment);
console.log('DATABASE_URL_DEV exists:', !!process.env.DATABASE_URL_DEV);
console.log('Connection string exists:', !!connectionString);

export const pool = new Pool({
    connectionString,
});
