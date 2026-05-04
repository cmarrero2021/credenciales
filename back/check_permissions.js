const pool = require('./src/db');

async function check() {
  const client = await pool.connect();
  try {
    const emails = ['admin@example.com', 'usuario@example.com'];
    for (const email of emails) {
      console.log('---', email, '---');
      const userRes = await client.query('SELECT id, first_name, last_name FROM users WHERE email = $1', [email]);
      if (!userRes.rows.length) {
        console.log('Usuario no encontrado');
        continue;
      }
      const user = userRes.rows[0];
      console.log('User id:', user.id, user.first_name, user.last_name);
      const perms = await client.query(`
        SELECT p.name
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = $1
      `, [user.id]);
      console.log('Permissions:', perms.rows.map(r => r.name).join(', '));

      const roles = await client.query(`
        SELECT r.name FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = $1
      `, [user.id]);
      console.log('Roles:', roles.rows.map(r => r.name).join(', '));
    }
  } catch (err) {
    console.error('Error checking permissions:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

check();
