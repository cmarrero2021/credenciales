const pool = require('../src/db');

(async () => {
    const timestamp = '2026-07-27 14:30:00-04';

    await pool.query('BEGIN');

    try {
        const rowsRes = await pool.query(`
      SELECT cedula, nombres, apellidos, institucion, area, cargo
      FROM vservidores
      WHERE lower(COALESCE(area, '')) LIKE '%rosa ines%'
      ORDER BY cedula
      LIMIT 31
    `);

        for (const row of rowsRes.rows) {
            await pool.query('UPDATE historico SET vigente = false WHERE cedula = $1 AND vigente IS TRUE', [row.cedula]);
            await pool.query(`
        INSERT INTO historico (
          institucion, cedula, nombres, apellidos, unidad, cargo, foto, printed_by,
          reimpreso_de, vigente, entregado, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL, TRUE, FALSE, $8)
      `, [
                row.institucion || null,
                row.cedula,
                row.nombres || null,
                row.apellidos || null,
                row.area || null,
                row.cargo || null,
                Buffer.from('x'),
                timestamp
            ]);
        }

        await pool.query('COMMIT');

        const check = await pool.query(`
      SELECT cedula, created_at, vigente, entregado
      FROM historico
      WHERE created_at = $1
        AND cedula IN (
          SELECT cedula FROM vservidores
          WHERE lower(COALESCE(area, '')) LIKE '%rosa ines%'
          ORDER BY cedula
          LIMIT 31
        )
      ORDER BY cedula
    `, [timestamp]);

        console.log(JSON.stringify({ inserted: check.rowCount, rows: check.rows }, null, 2));
    } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
    } finally {
        await pool.end();
    }
})().catch(err => {
    console.error(err);
    process.exit(1);
});
