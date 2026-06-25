-- ============================================================
-- FusionFit Gym — Add machine_type to members table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Add machine_type column ──────────────────────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS machine_type TEXT DEFAULT 'Gents';

-- ── 2. Back-fill existing rows with 'Gents' ────────────────
UPDATE members SET machine_type = 'Gents' WHERE machine_type IS NULL;

-- ── 3. Add CHECK constraint ─────────────────────────────────
ALTER TABLE members ADD CONSTRAINT chk_machine_type CHECK (machine_type IN ('Gents', 'Ladies'));

-- ── 4. Drop old unique constraint on biometric_user_id alone ─
-- (may exist as index or constraint — try both)
DROP INDEX IF EXISTS idx_members_biometric_user_id;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_biometric_user_id_key;

-- ── 5. Create composite unique index ────────────────────────
-- Same biometric ID can exist on different machines,
-- but must be unique within the same machine.
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_machine_biometric
  ON members (machine_type, biometric_user_id)
  WHERE biometric_user_id IS NOT NULL AND biometric_user_id != '';

-- ── 6. Add machine_type to attendance_logs for traceability ─
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS machine_type TEXT;
