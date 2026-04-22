-- fix-admin-perms.sql
-- Asegura que el rol 'Admin' tenga TODOS los permisos y que el usuario admin@example.com
-- tenga asignado el rol Admin. También garantiza que 'Usuario' tenga solo permisos limitados.

BEGIN;

-- Obtener ids
DO $$
DECLARE
  admin_role_id integer;
  user_role_id integer;
  admin_user_id integer;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  SELECT id INTO user_role_id FROM roles WHERE name = 'Usuario' LIMIT 1;
  SELECT id INTO admin_user_id FROM users WHERE email = 'admin@example.com' LIMIT 1;

  IF admin_role_id IS NULL THEN
    INSERT INTO roles (id, name, description) VALUES (1, 'Admin', 'Rol con todos los permisos')
    ON CONFLICT (id) DO NOTHING;
    SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  END IF;

  IF user_role_id IS NULL THEN
    INSERT INTO roles (id, name, description) VALUES (2, 'Usuario', 'Rol con permisos limitados para registro e impresión')
    ON CONFLICT (id) DO NOTHING;
    SELECT id INTO user_role_id FROM roles WHERE name = 'Usuario' LIMIT 1;
  END IF;

  -- Asignar todos los permisos al rol Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT admin_role_id, p.id FROM permissions p
  WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = admin_role_id AND rp.permission_id = p.id
  );

  -- Ajustar permisos del rol Usuario (solo ciertos permisos)
  DELETE FROM role_permissions WHERE role_id = user_role_id;
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT user_role_id, p.id FROM permissions p WHERE p.name IN ('create_servidor','print_credencial')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp WHERE rp.role_id = user_role_id AND rp.permission_id = p.id
  );

  -- Asegurar que el usuario admin tenga asignado el rol Admin
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT admin_user_id, admin_role_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = admin_user_id AND ur.role_id = admin_role_id
    );
  END IF;

END$$;

-- Actualizar secuencia de roles
SELECT setval(pg_get_serial_sequence('roles','id'), (SELECT COALESCE(MAX(id),2) FROM roles));

COMMIT;

-- Verificación rápida (ejecuta manualmente):
-- SELECT id, name FROM roles ORDER BY id;
-- SELECT rp.role_id, p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id IN (1,2) ORDER BY rp.role_id, p.name;
-- SELECT ur.user_id, ur.role_id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.email = 'admin@example.com';
