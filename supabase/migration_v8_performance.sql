-- ============================================================
-- FusionFit Gym Management System — Migration v8
-- Additional Performance Indexes
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Index on audit_logs created_at for fast cleanup and querying
-- (Also created in v7, this is idempotent)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Index on audit_logs action for login rate-limiting queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Index on members status for dashboard count queries
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

-- Index on users_profiles auth_user_id for fast profile lookups
-- (Should already exist as UNIQUE constraint, but ensuring index exists)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users_profiles' AND column_name = 'auth_user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_users_profiles_auth_user_id
      ON public.users_profiles(auth_user_id);
  END IF;
END $do$;

-- Composite index on attendance_logs for analytics queries
-- Only created if the table and columns exist (requires migration_v2_biometrics)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'punch_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_type_time
      ON public.attendance_logs(punch_type, punch_time DESC);
  END IF;
END $do$;

-- Index on invoices for monthly revenue aggregation
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_invoices_status_created
      ON public.invoices(status, created_at DESC);
  END IF;
END $do$;
