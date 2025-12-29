
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Need to load env before importing db if db uses env top-level
import { pool } from './src/lib/db';

async function check() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log('Columns:', res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit();
}
check();
