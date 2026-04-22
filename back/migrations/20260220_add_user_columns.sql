-- Migration: Add optional columns to support user management and toggling status
-- Adds: created_by (FK to users.id), deleted_at (soft-delete), status (active/inactive)
-- Adds indexes to improve queries

BEGIN;

-- created_by: reference to users.id (nullable)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_by integer;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_created_by_fkey'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END$$;

-- deleted_at: soft-delete timestamp
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- status: string to hold 'active'/'inactive' (fallback if app uses it)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS status varchar(32) DEFAULT 'active';

-- Indexes to help listing/filtering
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

COMMIT;

-- Optional: add printed_by to historico if controllers try to use it
BEGIN;
ALTER TABLE historico
    ADD COLUMN IF NOT EXISTS printed_by integer;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'historico_printed_by_fkey'
    ) THEN
        ALTER TABLE historico
            ADD CONSTRAINT historico_printed_by_fkey FOREIGN KEY (printed_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END$$;
COMMIT;
