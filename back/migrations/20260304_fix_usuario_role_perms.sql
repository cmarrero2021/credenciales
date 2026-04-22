-- Ensure Usuario role has server and credencial permissions, and remove RRHH-only permission update_historico
BEGIN;

-- Ensure role exists
INSERT INTO roles(name, description)
SELECT 'Usuario', 'Rol con permisos limitados' WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name ILIKE 'usuario');

-- Ensure the core permissions exist
INSERT INTO permissions(name, resource, action)
SELECT 'read_servidor','servidor','read' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_servidor');
INSERT INTO permissions(name, resource, action)
SELECT 'create_servidor','servidor','create' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'create_servidor');
INSERT INTO permissions(name, resource, action)
SELECT 'update_servidor','servidor','update' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_servidor');
INSERT INTO permissions(name, resource, action)
SELECT 'read_credencial','credencial','read' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_credencial');
INSERT INTO permissions(name, resource, action)
SELECT 'list_credencial','credencial','list' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'list_credencial');
INSERT INTO permissions(name, resource, action)
SELECT 'print_credencial','credencial','print' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'print_credencial');
INSERT INTO permissions(name, resource, action)
SELECT 'update_historico','historico','update' WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_historico');

-- Assign required permissions to Usuario role
WITH r AS (SELECT id AS role_id FROM roles WHERE name ILIKE 'usuario' LIMIT 1),
     p AS (SELECT id AS pid, name FROM permissions WHERE name IN ('create_servidor','read_servidor','update_servidor','read_credencial','list_credencial','print_credencial'))
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.role_id, p.pid FROM r, p
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.role_id AND rp.permission_id = p.pid
);

-- Remove RRHH-only permission 'update_historico' from Usuario role if present
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name ILIKE 'usuario'
  AND p.name = 'update_historico';

COMMIT;
