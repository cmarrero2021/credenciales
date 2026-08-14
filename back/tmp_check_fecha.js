const pool = require('./src/db');
(async () => {
  const cedula = '9978480';
  try {
    const r = await pool.query('SELECT cedula, fecha_ingreso FROM servidores WHERE cedula = $1', [cedula]);
    console.log('DB result:', JSON.stringify(r.rows, null, 2));
  } catch (e) {
    console.error('QUERY ERROR', e && e.message ? e.message : e);
  } finally {
    process.exit();
  }
})();