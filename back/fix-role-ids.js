require('dotenv').config();
const pool = require('./src/db');

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const selUsuario = await client.query("SELECT id FROM roles WHERE name = 'Usuario'");
    const usuarioRow = selUsuario.rows[0];
    if (!usuarioRow) {
      // If no Usuario role, try to create with id=2 if free
      const sel2 = await client.query('SELECT id, name FROM roles WHERE id = 2');
      if (sel2.rows.length === 0) {
        const ins = await client.query("INSERT INTO roles (id, name, description) VALUES (2, 'Usuario', 'Rol con permisos limitados para registro e impresión') RETURNING id");
        console.log('Created Usuario with id=', ins.rows[0].id);
        await client.query('COMMIT');
        return;
      } else {
        // id 2 taken, insert normally and we'll attempt to swap
        const ins = await client.query("INSERT INTO roles (name, description) VALUES ('Usuario', 'Rol con permisos limitados para registro e impresión') RETURNING id");
        console.log('Created Usuario with id=', ins.rows[0].id, 'will attempt to move to id=2');
      }
    }

    // Re-query usuario id in case it was created above
    const curUsuarioRes = await client.query("SELECT id FROM roles WHERE name = 'Usuario'");
    const usuarioId = curUsuarioRes.rows[0].id;
    if (usuarioId === 2) {
      console.log('Usuario already has id=2. Nothing to do.');
      await client.query('COMMIT');
      return;
    }

    // Check if id 2 exists
    const sel2 = await client.query('SELECT id, name FROM roles WHERE id = 2');
    const id2Exists = sel2.rows.length > 0;

    // Determine temporary id
    const maxRes = await client.query('SELECT COALESCE(MAX(id), 0) AS maxid FROM roles');
    const tempId = parseInt(maxRes.rows[0].maxid, 10) + 1;

    if (id2Exists) {
      console.log('Role with id=2 exists (name=' + sel2.rows[0].name + '). Moving it temporarily to id=' + tempId);
      await client.query('UPDATE role_permissions SET role_id = $1 WHERE role_id = $2', [tempId, 2]);
      await client.query('UPDATE user_roles SET role_id = $1 WHERE role_id = $2', [tempId, 2]);
      await client.query('UPDATE roles SET id = $1 WHERE id = $2', [tempId, 2]);
    }

    console.log('Moving Usuario id', usuarioId, 'to id=2');
    // Move usuario to id=2
    await client.query('UPDATE role_permissions SET role_id = $1 WHERE role_id = $2', [2, usuarioId]);
    await client.query('UPDATE user_roles SET role_id = $1 WHERE role_id = $2', [2, usuarioId]);
    await client.query('UPDATE roles SET id = $1 WHERE id = $2', [2, usuarioId]);

    if (id2Exists) {
      console.log('Restoring previous id (tempId=' + tempId + ') to original usuarioId=' + usuarioId);
      await client.query('UPDATE role_permissions SET role_id = $1 WHERE role_id = $2', [usuarioId, tempId]);
      await client.query('UPDATE user_roles SET role_id = $1 WHERE role_id = $2', [usuarioId, tempId]);
      await client.query('UPDATE roles SET id = $1 WHERE id = $2', [usuarioId, tempId]);
    }

    await client.query('COMMIT');
    console.log('Done: Usuario role now has id=2');
  } catch (err) {
    console.error('Error fixing role ids:', err);
    try { await client.query('ROLLBACK'); } catch (e) { console.error('Rollback failed', e); }
  } finally {
    client.release();
  }
}

main();
