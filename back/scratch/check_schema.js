const pool = require('./src/db');
async function checkSchema() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'servidores'
        `);
        console.log('Columns in servidores:');
        console.table(res.rows);

        const res2 = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'fotos_usuarios'
        `);
        console.log('Columns in fotos_usuarios:');
        console.table(res2.rows);
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        process.exit();
    }
}
checkSchema();
