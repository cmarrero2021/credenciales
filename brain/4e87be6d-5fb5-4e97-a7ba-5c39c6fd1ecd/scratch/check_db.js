module.paths.push('c:/Users/Desarrollo/Documents/credenciales/back/node_modules');
require('dotenv').config({ path: 'c:/Users/Desarrollo/Documents/credenciales/back/.env' });
const pool = require('c:/Users/Desarrollo/Documents/credenciales/back/src/db');

async function run() {
    try {
        console.log("Connecting to DB...");
        const res = await pool.query("SELECT id, email, username FROM users LIMIT 10");
        console.log("Users in DB:", res.rows);
        process.exit(0);
    } catch (err) {
        console.error("Diagnostic ERROR:", err);
        process.exit(1);
    }
}
run();
