-- Migration: 20260226_add_historico_disable_columns.sql
-- Añade columnas para almacenar motivo y fecha de deshabilitación en la tabla `historico`.
-- Ejecutar en el esquema de la base de datos `credenciales`.
--
-- UP: aplicar cambios
BEGIN;

ALTER TABLE historico
  ADD COLUMN IF NOT EXISTS motivo_deshabilitado TEXT;

ALTER TABLE historico
  ADD COLUMN IF NOT EXISTS fecha_deshabilitado TIMESTAMPTZ;

COMMIT;

-- -----------------------------------------------------------------------------
-- ROLLBACK (ejecutar manualmente si se necesita revertir):
-- Nota: realizar backup antes de ejecutar el rollback en producción.
--
-- BEGIN;
-- ALTER TABLE historico DROP COLUMN IF EXISTS fecha_deshabilitado;
-- ALTER TABLE historico DROP COLUMN IF EXISTS motivo_deshabilitado;
-- COMMIT;
-- -----------------------------------------------------------------------------

-- Recomendación: hacer un `VACUUM ANALYZE historico;` después de cambios masivos si procede.
