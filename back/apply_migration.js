const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/db');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20260528_create_server_mass_uploads.sql'), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Migration applied successfully.');
    } catch (e) {
      await client.query('ROLLBACK').catch(()=>{});
      console.error('Migration failed:', e.message);
      process.exit(1);
    } finally {
      client.release();
      process.exit(0);
    }
  } catch (err) {
    console.error('Could not read migration file or connect:', err.message);
    process.exit(1);
  }
}
run();
