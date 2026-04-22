-- fix-role-mappings.sql
-- Verificar y corregir role_permissions y user_roles tras el cambio de ids
BEGIN;

-- 1) Mostrar estado actual (ejecutar manualmente si quieres inspeccionar)
-- SELECT * FROM roles ORDER BY id;
-- SELECT rp.role_id, rp.permission_id, p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id ORDER BY rp.role_id, rp.permission_id;
-- SELECT ur.user_id, ur.role_id, u.email FROM user_roles ur JOIN users u ON u.id = ur.user_id ORDER BY ur.user_id;

-- 2) Asegurar que el rol Admin (id=1) tenga TODOS los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, p.id FROM permissions p
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = 1 AND rp.permission_id = p.id
);

-- 3) Asegurar que el rol Usuario (id=2) tenga solo permisos limitados esperados
-- Ajusta la lista de permisos permitidos para el rol Usuario según tu app
-- Ejemplo: create_servidor y print_credencial
DELETE FROM role_permissions WHERE role_id = 2;
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, p.id FROM permissions p WHERE p.name IN ('create_servidor', 'print_credencial');

-- 4) Asegurar que usuarios concretos tienen los roles
-- Asignar rol Admin (id=1) al usuario admin@example.com
DO $$
DECLARE uid integer;
BEGIN
  SELECT id INTO uid FROM users WHERE email = 'admin@example.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role_id = 1) THEN
      INSERT INTO user_roles (user_id, role_id) VALUES (uid, 1);
    END IF;
  END IF;
END$$;

-- Asignar rol Usuario (id=2) al usuario usuario@example.com
DO $$
DECLARE uid integer;
BEGIN
  SELECT id INTO uid FROM users WHERE email = 'usuario@example.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role_id = 2) THEN
      INSERT INTO user_roles (user_id, role_id) VALUES (uid, 2);
    END IF;
  END IF;
END$$;

-- 5) Actualizar secuencia por si acaso
PERFORM setval(pg_get_serial_sequence('roles','id'), (SELECT COALESCE(MAX(id),2) FROM roles));

COMMIT;

-- FIN
