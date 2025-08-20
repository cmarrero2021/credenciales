const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10), // Convierte el puerto a número
});
pool.connect()
    .then(() => {
        console.log('Conexión exitosa a PostgreSQL.');
    })
    .catch((err) => {
        console.error('Error al conectar a PostgreSQL:', err.message);
    });
module.exports = pool;