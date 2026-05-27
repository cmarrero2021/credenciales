const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

(async function(){
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.error('Uploads dir not found:', uploadsDir);
    process.exit(1);
  }
  const files = fs.readdirSync(uploadsDir).filter(f => f && f !== '.' && f !== '..');
  const client = await pool.connect();
  const rechazadas = [];
  const insertadas = [];
  const actualizadas = [];
  try {
    for (const f of files) {
      try {
        const cedula = f.replace(/\.[^/.]+$/, '').replace(/\D/g,'');
        if (!cedula) {
          rechazadas.push({ file: f, reason: 'no_cedula_en_nombre' });
          continue;
        }
        const res = await client.query('SELECT id FROM servidores WHERE cedula = $1', [cedula]);
        if (res.rows.length === 0) {
          rechazadas.push({ file: f, cedula, reason: 'servidor_no_encontrado' });
          continue;
        }
        // Encontrado: considerarlo actualizado (no tocar BD fotos_usuarios)
        actualizadas.push(cedula);
      } catch (e) {
        rechazadas.push({ file: f, reason: 'error_procesando' });
      }
    }

    const now = new Date().toISOString();
    const latestObj = { generated_at: now, user_id: null, total_files: files.length, resultado: { procesadas: actualizadas.length + insertadas.length + rechazadas.length, insertadas, actualizadas, rechazadas } };
    const latestPath = path.join(uploadsDir, 'mass_upload_errors_latest.json');
    const historyPath = path.join(uploadsDir, 'mass_upload_errors_history.log');
    fs.writeFileSync(latestPath, JSON.stringify(latestObj, null, 2), 'utf8');
    const lines = rechazadas.map(r => ({ timestamp: now, user_id: null, file: r.file || null, cedula: r.cedula || null, reason: r.reason || null }));
    if (lines.length > 0) fs.appendFileSync(historyPath, lines.map(l => JSON.stringify(l)).join('\n') + '\n', 'utf8');

    // Insert into DB mass_uploads and mass_upload_errors
    try {
      const uploadRes = await client.query('INSERT INTO mass_uploads (user_id, total_files, summary) VALUES ($1, $2, $3) RETURNING id', [null, files.length, JSON.stringify(latestObj.resultado)]);
      const uploadId = uploadRes.rows[0].id;
      for (const r of rechazadas) {
        await client.query('INSERT INTO mass_upload_errors (upload_id, file_name, cedula, reason, details) VALUES ($1, $2, $3, $4, $5)', [uploadId, r.file || null, r.cedula || null, r.reason || null, null]);
      }
    } catch (dbErr) {
      console.warn('No se pudo insertar en BD:', dbErr && dbErr.message ? dbErr.message : dbErr);
    }

    console.log('Rebuilt latest errors file at', latestPath);
    console.log('Summary:', latestObj);
  } catch (err) {
    console.error('Error reconstruyendo errores:', err);
  } finally {
    client.release();
    process.exit(0);
  }
})();
