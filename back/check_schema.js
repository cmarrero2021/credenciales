require('dotenv').config();
const pool = require('./src/db');

async function run() {
    try {
        const res1 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'mass_upload_errors'");
        console.log('mass_upload_errors columns:', res1.rows.map(r => r.column_name));
        
        const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'mass_uploads'");
        console.log('mass_uploads columns:', res2.rows.map(r => r.column_name));
        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}
run();
