const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10),
});

async function runAlter() {
    try {
        console.log('Running ALTER TABLE statements...');
        await pool.query("ALTER TABLE servidores ADD COLUMN IF NOT EXISTS condicion VARCHAR(50) DEFAULT 'ACTIVO'");
        await pool.query("ALTER TABLE servidores ALTER COLUMN area_id DROP NOT NULL");
        await pool.query("ALTER TABLE servidores ALTER COLUMN cargo_id DROP NOT NULL");
        console.log('ALTER TABLE statements completed successfully.');
    } catch (err) {
        console.error('Error during ALTER TABLE:', err);
    } finally {
        await pool.end();
    }
}

runAlter();
