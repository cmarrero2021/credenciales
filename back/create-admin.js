// create-admin.js

require('dotenv').config();
const { hashPassword } = require('./src/utils');
const pool = require('./src/db');

// Datos del administrador
const adminUser = {
  firstName: 'Admin',
  lastName: 'Principal',
  cedula: 12345678,
  email: 'admin@example.com',
  password: 'Admin123$',
};

// Definición de recursos y acciones para los permisos
const resources = ['user', 'role', 'permission', 'revista', 'servidor', 'credencial', 'historico'];
const actions = ['create', 'read', 'update', 'delete', 'print', 'list'];

// Crea permisos y devuelve un mapa {permissionName: id}
async function createPermissions(client) {
  const permissionMap = {};

  async function getOrCreatePermission(name, resource, action) {
    const sel = await client.query('SELECT id FROM permissions WHERE name = $1', [name]);
    if (sel.rows.length) return sel.rows[0].id;
    const ins = await client.query('INSERT INTO permissions (name, resource, action) VALUES ($1,$2,$3) RETURNING id', [name, resource, action]);
    return ins.rows[0].id;
  }

  for (const resource of resources) {
    for (const action of actions) {
      const name = `${action}_${resource}`;
      const id = await getOrCreatePermission(name, resource, action);
      permissionMap[name] = id;
    }
  }

  console.log('✅ Permisos creados o actualizados');
  // Crear permisos alias usados por el front (plurales / view flags)
  async function ensureAlias(name, resource, action) {
    const sel = await client.query('SELECT id FROM permissions WHERE name = $1', [name]);
    if (sel.rows.length) {
      permissionMap[name] = sel.rows[0].id;
      return;
    }
    const ins = await client.query('INSERT INTO permissions (name, resource, action) VALUES ($1,$2,$3) RETURNING id', [name, resource, action]);
    permissionMap[name] = ins.rows[0].id;
  }

  // Some frontend checks use these alternative names; ensure they exist
  await ensureAlias('list_users', 'user', 'list');
  await ensureAlias('list_roles', 'role', 'list');
  await ensureAlias('view_admin', 'admin', 'view');
  await ensureAlias('view_admin1', 'admin', 'view');
  return permissionMap;
}

async function createAdminRole(client, permissionIds) {
  // Crear el rol Admin si no existe (SELECT + INSERT)
  const selRole = await client.query('SELECT id FROM roles WHERE name = $1', ['Admin']);
  let roleId;
  if (selRole.rows.length) {
    roleId = selRole.rows[0].id;
  } else {
    const ins = await client.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING id', ['Admin', 'Rol con todos los permisos']);
    roleId = ins.rows[0].id;
  }

  // Asignar todos los permisos al rol Admin (permissionIds may be a map)
  const permissionEntries = Array.isArray(permissionIds) ? permissionIds : Object.values(permissionIds);
  for (const permissionId of permissionEntries) {
    const exists = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permissionId]);
    if (!exists.rows.length) {
      await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)', [roleId, permissionId]);
    }
  }

  console.log('✅ Rol Admin creado y permisos asignados');
  return roleId;
}

async function createAdminUser(client, roleId) {
  // Verificar si el usuario ya existe por correo o cédula
  const checkUser = await client.query(
    `SELECT id FROM users WHERE email = $1 OR cedula = $2`,
    [adminUser.email, adminUser.cedula]
  );
  let userId = null;
  if (checkUser.rows.length > 0) {
    userId = checkUser.rows[0].id;
    console.log('⚠️ El usuario Administrador ya existe. Se comprobará asignación de rol.');
  } else {
    // Hash de la contraseña
    const hashedPassword = await hashPassword(adminUser.password);

    // Crear el usuario
    const userRes = await client.query(
      `INSERT INTO users (first_name, last_name, cedula, email, password_hash, is_email_verified, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        adminUser.firstName,
        adminUser.lastName,
        adminUser.cedula,
        adminUser.email,
        hashedPassword,
        true, // is_email_verified
        'active',
      ]
    );
    userId = userRes.rows[0].id;
    console.log(`✅ Usuario administrador creado con ID: ${userId}`);
  }

  // Asegurar que el usuario tenga asignado el rol Admin
  try {
    const existsUR = await client.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
    if (!existsUR.rows.length) {
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    }
    console.log('✅ Rol Admin asignado/verificado para el usuario administrador');
  } catch (e) {
    console.error('Error asignando rol Admin al usuario existente:', e.message);
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const permissionMap = await createPermissions(client);
    const roleId = await createAdminRole(client, permissionMap);
    await createAdminUser(client, roleId);

    // Crear/asegurar rol Usuario con permisos limitados (registrar servidores e imprimir credenciales)
    // Queremos que el rol 'Usuario' tenga preferiblemente el id 2 (si está disponible).
    async function getOrCreateRole(name, description, preferredId = null) {
      // Si ya existe por nombre, devolver id
      const sel = await client.query('SELECT id FROM roles WHERE name = $1', [name]);
      if (sel.rows.length) return sel.rows[0].id;

      // Si se especificó preferredId, intentar insertarlo con ese id si no existe
      if (preferredId !== null) {
        const existsId = await client.query('SELECT id FROM roles WHERE id = $1', [preferredId]);
        if (existsId.rows.length === 0) {
          const ins = await client.query('INSERT INTO roles (id, name, description) VALUES ($1,$2,$3) RETURNING id', [preferredId, name, description]);
          return ins.rows[0].id;
        }
        // si el id ya está ocupado por otro rol, caeremos al insert normal
      }

      const ins = await client.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING id', [name, description]);
      return ins.rows[0].id;
    }

    const usuarioRoleId = await getOrCreateRole('Usuario', 'Rol con permisos limitados para registro e impresión', 2);

    const permisosUsuario = [];
    if (permissionMap['create_servidor']) permisosUsuario.push(permissionMap['create_servidor']);
    if (permissionMap['print_credencial']) permisosUsuario.push(permissionMap['print_credencial']);

    for (const pid of permisosUsuario) {
      const exists = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [usuarioRoleId, pid]);
      if (!exists.rows.length) {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)', [usuarioRoleId, pid]);
      }
    }
    console.log('✅ Rol Usuario creado/asegurado (id=' + usuarioRoleId + ') y permisos asignados');
    // Crear usuario común (si no existe) y asignarle el rol Usuario
    const commonUser = {
      firstName: 'Usuario',
      lastName: 'Comun',
      cedula: 99999999,
      email: 'usuario@example.com',
      password: 'Usuario123$'
    };

    const checkCommon = await client.query(`SELECT id FROM users WHERE email = $1 OR cedula = $2`, [commonUser.email, commonUser.cedula]);
    let commonUserId = null;
    if (checkCommon.rows.length > 0) {
      commonUserId = checkCommon.rows[0].id;
      console.log('⚠️ Usuario común ya existe, se verificará rol.');
    } else {
      const hashedCommon = await hashPassword(commonUser.password);
      const userRes = await client.query(
        `INSERT INTO users (first_name, last_name, cedula, email, password_hash, is_email_verified, status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [commonUser.firstName, commonUser.lastName, commonUser.cedula, commonUser.email, hashedCommon, true, 'active']
      );
      commonUserId = userRes.rows[0].id;
      console.log(`✅ Usuario común creado con ID: ${commonUserId}`);
    }

    // Asignar rol Usuario al usuario común
    const existsUR = await client.query('SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2', [commonUserId, usuarioRoleId]);
    if (!existsUR.rows.length) {
      await client.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [commonUserId, usuarioRoleId]);
    }
    console.log('✅ Rol Usuario asignado/verificado para el usuario común');
    await client.query('COMMIT');
    console.log('✅ Rol y usuario administrador creados exitosamente');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Error al crear el rol y usuario administrador:', e);
  } finally {
    client.release();
  }
}

main();