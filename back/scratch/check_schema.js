const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/db');
async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT cedula, nombres, apellidos FROM servidores LIMIT 5');
        console.log('Servidores:');
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        process.exit();
    }
}
checkSchema();
