const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../src/db');
const controllers = require('../src/controllers');

async function runTest() {
    const client = await pool.connect();
    try {
        // Ensure server has the condicion column
        await client.query("ALTER TABLE servidores ADD COLUMN IF NOT EXISTS condicion VARCHAR(50) DEFAULT 'ACTIVO'");
        await client.query("ALTER TABLE servidores ALTER COLUMN area_id DROP NOT NULL");
        await client.query("ALTER TABLE servidores ALTER COLUMN cargo_id DROP NOT NULL");

        // Insert dummy server with cedula 7920566 if not exists
        const check = await client.query('SELECT id FROM servidores WHERE cedula = $1', ['7920566']);
        if (check.rows.length === 0) {
            console.log('Inserting dummy servidor...');
            await client.query(
                "INSERT INTO servidores (cedula, nombres, apellidos, condicion) VALUES ($1, $2, $3, $4)",
                ['7920566', 'PEDRO', 'PEREZ', 'ACTIVO']
            );
        } else {
            console.log('Dummy servidor already exists.');
        }

        // Mock req and res
        const req = {
            params: { cedula: '7920566' },
            body: {
                area_id: '',
                institucion_id: '',
                sede_id: '',
                cargo_id: '',
                cedula: '7920566',
                nombres: 'PEDRO',
                apellidos: 'PEREZ',
                condicion: 'ACTIVO'
            },
            file: {
                path: 'uploads/20260519_073328_7920566.png'
            }
        };

        const res = {
            status: function(code) {
                console.log('res.status called with:', code);
                return this;
            },
            json: function(data) {
                console.log('res.json called with:', data);
                return this;
            }
        };

        // Create a dummy file if needed so that unlinkSync doesn't fail, or handle it
        const fs = require('fs');
        const dir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        fs.writeFileSync(path.join(__dirname, '../uploads/20260519_073328_7920566.png'), 'dummy content');

        console.log('Calling updateServer...');
        await controllers.updateServer(req, res);

    } catch (err) {
        console.error('Test execution caught error:', err);
    } finally {
        client.release();
        process.exit();
    }
}

runTest();
