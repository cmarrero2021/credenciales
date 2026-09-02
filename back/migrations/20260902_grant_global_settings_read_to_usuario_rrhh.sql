-- Permite que los toggles globales del administrador (omitir regla < 3 meses y
-- habilitar/deshabilitar impresión de franja) surtan efecto en TODOS los roles
-- (Admin, Usuario común y RRHH).
--
-- Para lograrlo, el rol 'Usuario' y 'RRHH' deben poder LEER la configuración global
-- (get_global_session_settings). Sólo el rol admin puede modificarla
-- (update_global_session_settings).

BEGIN;

-- 1) Limpiar permisos duplicados (misma name, filas repetidas) de la tabla permissions
DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.ctid::text <> (SELECT min(p2.ctid::text) FROM permissions p2 WHERE p2.name = p.name);

DELETE FROM permissions p
WHERE p.ctid::text <> (SELECT min(p2.ctid::text) FROM permissions p2 WHERE p2.name = p.name);

-- 2) Asegurar que el rol Admin (id=1) tenga TODOS los permisos existentes
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id);

-- 3) Otorgar permiso de LECTURA de configuración global a 'Usuario' y 'RRHH'
--    para que los toggles del admin surtan efecto en estos roles.
WITH roles_a_permitir AS (
    SELECT id FROM roles WHERE id IN (2, 3) OR name IN ('Usuario', 'RRHH')
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT ro.id, p.id
FROM roles_a_permitir ro
JOIN permissions p ON p.name = 'get_global_session_settings'
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = ro.id AND rp.permission_id = p.id
);

-- 4) Otorgar permiso de LECTURA de servidores al rol 'RRHH'
--    para que pueda ver el módulo de carnets y listar/buscar servidores para imprimir.
--    (No se le otorgan permisos de edición: update_servidor/delete_servidor se mantienen en Admin).
WITH rrhh AS (
    SELECT id FROM roles WHERE id = 3 OR name = 'RRHH'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT ro.id, p.id
FROM rrhh ro
JOIN permissions p ON p.name IN ('read_servidor', 'list_servidor')
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = ro.id AND rp.permission_id = p.id
);

COMMIT;
