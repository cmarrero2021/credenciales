BEGIN;

-- Remove server management permissions from RRHH (role id 3)
DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND (r.id = 3 OR r.name = 'RRHH')
  AND p.name IN ('update_servidor','delete_servidor');

-- Ensure credential-related permissions exist
INSERT INTO permissions (name, resource, action)
SELECT 'list_credencial','credencial','list'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'list_credencial');

INSERT INTO permissions (name, resource, action)
SELECT 'read_credencial','credencial','read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_credencial');

INSERT INTO permissions (name, resource, action)
SELECT 'update_historico','historico','update'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_historico');

INSERT INTO permissions (name, resource, action)
SELECT 'print_credencial','credencial','print'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'print_credencial');

-- Assign credential permissions to RRHH (role id 3)
WITH r AS (SELECT id AS rid FROM roles WHERE id = 3 OR name = 'RRHH'),
     p AS (SELECT id AS pid FROM permissions WHERE name IN ('list_credencial','read_credencial','update_historico','print_credencial'))
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.rid, p.pid FROM r JOIN p ON true
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.rid AND rp.permission_id = p.pid);

COMMIT;
