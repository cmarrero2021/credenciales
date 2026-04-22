BEGIN;

-- Asegurar que exista el rol Usuario con id 2 si falta
INSERT INTO roles (id, name, description)
SELECT 2, 'Usuario', 'Rol con permisos limitados'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 2 OR name = 'Usuario');

-- Crear el usuario comun si no existe
INSERT INTO users (first_name, last_name, cedula, email, password_hash, is_email_verified, status)
SELECT 'Usuario', 'Comun', 99999999, 'usuario@example.com', NULL, true, 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'usuario@example.com' OR cedula = 99999999);

-- Asignar rol Usuario al usuario comun
WITH u AS (SELECT id uid FROM users WHERE email = 'usuario@example.com'),
     r AS (SELECT id rid FROM roles WHERE id = 2 OR name = 'Usuario')
INSERT INTO user_roles (user_id, role_id)
SELECT u.uid, r.rid FROM u, r
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.uid AND ur.role_id = r.rid);

-- Asegurar que el rol Admin tenga permisos list_roles y list_users
WITH r AS (SELECT id rid FROM roles WHERE id = 1 OR name = 'Admin'),
     p AS (SELECT id pid, name FROM permissions WHERE name IN ('list_roles','list_users'))
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.rid, p.pid FROM r JOIN p ON true
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.rid AND rp.permission_id = p.pid);

COMMIT;
