-- Ensure required permissions exist and assign them to role 'Usuario' (prefer id=2)
BEGIN;

-- Create permissions if missing
INSERT INTO permissions(name, resource, action)
SELECT 'read_servidor','servidor','read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_servidor');

INSERT INTO permissions(name, resource, action)
SELECT 'update_servidor','servidor','update'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_servidor');

INSERT INTO permissions(name, resource, action)
SELECT 'create_servidor','servidor','create'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'create_servidor');

-- Credencial permissions to allow viewing/printing/listing
INSERT INTO permissions(name, resource, action)
SELECT 'read_credencial','credencial','read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_credencial');

INSERT INTO permissions(name, resource, action)
SELECT 'list_credencial','credencial','list'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'list_credencial');

INSERT INTO permissions(name, resource, action)
SELECT 'print_credencial','credencial','print'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'print_credencial');

-- Determine role id for 'Usuario' (fallback to id=2)
WITH r AS (
  SELECT id FROM roles WHERE name ILIKE 'usuario' LIMIT 1
), rid AS (
  SELECT COALESCE((SELECT id FROM r), 2) AS role_id
)
-- Insert role_permissions for each permission name
INSERT INTO role_permissions(role_id, permission_id)
SELECT rid.role_id, p.id FROM rid, permissions p
WHERE p.name IN (
  'read_servidor','update_servidor','create_servidor',
  'read_credencial','list_credencial','print_credencial'
)
AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = rid.role_id AND rp.permission_id = p.id
);

COMMIT;
