-- fix-role-ids.sql
-- Ejecutar en PostgreSQL como un usuario con permisos para UPDATE/SELECT
-- Ajusta los ids de roles para que:
--  - 'Admin' tenga id = 1
--  - 'Usuario' tenga id = 2
-- El script intentará evitar conflictos usando ids temporales negativos.

BEGIN;

-- Obtener ids actuales
DO $$
DECLARE
  admin_old integer;
  user_old integer;
  temp_id integer := -1000;
  r RECORD;
BEGIN
  SELECT id INTO admin_old FROM roles WHERE name = 'Admin' LIMIT 1;
  SELECT id INTO user_old FROM roles WHERE name = 'Usuario' LIMIT 1;

  IF admin_old IS NULL THEN
    RAISE NOTICE 'No existe rol Admin, abortando.';
    RETURN;
  END IF;
  IF user_old IS NULL THEN
    RAISE NOTICE 'No existe rol Usuario, abortando.';
    RETURN;
  END IF;

  RAISE NOTICE 'Admin id = %, Usuario id = %', admin_old, user_old;

  -- Si ya están correctos, salir
  IF admin_old = 1 AND user_old = 2 THEN
    RAISE NOTICE 'Los roles ya tienen los ids correctos.';
    RETURN;
  END IF;

  -- Mover cualquier fila existente con id 1 o 2 (que no sean los roles objetivo) a un id temporal
  FOR r IN SELECT id, name FROM roles WHERE id IN (1,2) AND name NOT IN ('Admin','Usuario') LOOP
    RAISE NOTICE 'Moviendo rol inesperado % (id=%) a temp id %', r.name, r.id, temp_id;
    UPDATE role_permissions SET role_id = temp_id WHERE role_id = r.id;
    UPDATE user_roles SET role_id = temp_id WHERE role_id = r.id;
    UPDATE roles SET id = temp_id WHERE id = r.id;
    temp_id := temp_id - 1;
  END LOOP;

  -- Si Admin no tiene id 1, actualizar referencias
  IF admin_old <> 1 THEN
    RAISE NOTICE 'Asignando id 1 a Admin (desde %).', admin_old;
    UPDATE role_permissions SET role_id = 1 WHERE role_id = admin_old;
    UPDATE user_roles SET role_id = 1 WHERE role_id = admin_old;
    UPDATE roles SET id = 1 WHERE name = 'Admin';
  END IF;

  -- Recalcular user_old en caso de que haya cambiado
  SELECT id INTO user_old FROM roles WHERE name = 'Usuario' LIMIT 1;

  -- Si Usuario no tiene id 2, actualizar referencias
  IF user_old <> 2 THEN
    RAISE NOTICE 'Asignando id 2 a Usuario (desde %).', user_old;
    UPDATE role_permissions SET role_id = 2 WHERE role_id = user_old;
    UPDATE user_roles SET role_id = 2 WHERE role_id = user_old;
    UPDATE roles SET id = 2 WHERE name = 'Usuario';
  END IF;

  -- Finalmente, reasignar cualquier id temporal negativo a valores positivos libres
  FOR r IN SELECT id FROM roles WHERE id < 0 LOOP
    -- obtener nuevo id como max(id)+1
    EXECUTE 'SELECT COALESCE(MAX(id),2)+1 FROM roles' INTO temp_id;
    RAISE NOTICE 'Reasignando temporal id % a %', r.id, temp_id;
    UPDATE role_permissions SET role_id = temp_id WHERE role_id = r.id;
    UPDATE user_roles SET role_id = temp_id WHERE role_id = r.id;
    UPDATE roles SET id = temp_id WHERE id = r.id;
  END LOOP;

  -- Asegurar que la secuencia nextval para roles.id esté a la par
  PERFORM setval(pg_get_serial_sequence('roles','id'), (SELECT COALESCE(MAX(id),2) FROM roles));

  RAISE NOTICE 'Ajustes completados.';
END$$;

COMMIT;

-- FIN
