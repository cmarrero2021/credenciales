-- Migration: Allow 'disabled' in users.status check constraint
BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
    END IF;
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'deactivated'::text, 'inactive'::text, 'disabled'::text]));
END$$;

COMMIT;
