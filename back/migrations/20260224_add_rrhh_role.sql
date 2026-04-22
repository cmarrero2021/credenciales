BEGIN;

-- Crear rol RRHH con id 3 si no existe
INSERT INTO roles (id, name, description)
SELECT 3, 'RRHH', 'Recursos Humanos - puede ver credenciales y habilitar/deshabilitar trabajadores y credenciales'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE id = 3 OR name = 'RRHH');

-- Asegurar permisos necesarios para RRHH
-- Ver credenciales
INSERT INTO permissions (name, resource, action)
SELECT 'list_credencial', 'credencial', 'list'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'list_credencial');

INSERT INTO permissions (name, resource, action)
SELECT 'read_credencial', 'credencial', 'read'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'read_credencial');

-- Habilitar/deshabilitar servidores (activo)
INSERT INTO permissions (name, resource, action)
SELECT 'update_servidor', 'servidor', 'update'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_servidor');

-- Borrar/habilitar servidores (se usan endpoints PATCH/DELETE)
INSERT INTO permissions (name, resource, action)
SELECT 'delete_servidor', 'servidor', 'delete'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'delete_servidor');

-- Actualizar histórico/credencial vigente
INSERT INTO permissions (name, resource, action)
SELECT 'update_historico', 'historico', 'update'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'update_historico');

-- Asegurar asignación de permisos al rol RRHH
WITH r AS (SELECT id AS rid FROM roles WHERE id = 3 OR name = 'RRHH'),
     p AS (SELECT id AS pid, name FROM permissions WHERE name IN ('list_credencial','read_credencial','update_servidor','delete_servidor','update_historico'))
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.rid, p.pid FROM r JOIN p ON true
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.rid AND rp.permission_id = p.pid);

COMMIT;
