-- ============================================================
-- SOLUCIÓN TOGGLES PRODUCCIÓN - CREAR COLUMNAS + PERMISOS
-- Idempotente (se puede ejecutar varias veces sin romper nada)
-- Ejecutar como superusuario de la BD del servidor de producción
-- ============================================================

-- 1) Agregar las columnas que faltan a session_settings
ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS omitir_regla_3_meses boolean NOT NULL DEFAULT false;

ALTER TABLE public.session_settings
    ADD COLUMN IF NOT EXISTS habilitar_impresion_franja boolean NOT NULL DEFAULT true;

-- 2) Permisos: Admin con todo, Usuario y RRHH pueden LEER la config global,
--    y RRHH puede leer la lista/búsqueda de servidores para el módulo de carnets.
BEGIN;

-- Limpiar permisos duplicados en caso de que existan
DELETE FROM role_permissions rp
USING permissions p
WHERE rp.permission_id = p.id
  AND p.ctid::text <> (SELECT min(p2.ctid::text) FROM permissions p2 WHERE p2.name = p.name);

DELETE FROM permissions p
WHERE p.ctid::text <> (SELECT min(p2.ctid::text) FROM permissions p2 WHERE p2.name = p.name);

-- Admin con todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id);

-- Usuario y RRHH: lectura de config global
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

-- RRHH: lectura de servidores (módulo de carnets)
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

-- Limpiar la sesión cacheada del admin para que tome los nuevos permisos (si aplica)
DELETE FROM sessions WHERE user_id = 1 AND is_revoked = true;

COMMIT;
