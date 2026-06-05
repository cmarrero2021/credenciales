const { Pool } = require('pg');
const path = require('path');
// Intentar cargar .env localizado en la carpeta `back` para entornos locales
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) { }

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: (typeof process.env.DB_PASSWORD === 'undefined' || process.env.DB_PASSWORD === null) ? undefined : String(process.env.DB_PASSWORD),
    port: Number.isNaN(parseInt(process.env.DB_PORT, 10)) ? undefined : parseInt(process.env.DB_PORT, 10), // Convierte el puerto a número o undefined
});
pool.connect()
    .then(() => {
        console.log('Conexión exitosa a PostgreSQL.');
    })
    .catch((err) => {
        console.error('Error al conectar a PostgreSQL:', err.message);
    });
module.exports = pool;