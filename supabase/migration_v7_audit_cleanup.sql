-- ============================================================
-- FusionFit Gym Management System — Migration v7
-- Automatic Audit Log Cleanup (5-day retention)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '5 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Add index on audit_logs.created_at for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- 3. Schedule daily cleanup using pg_cron
-- NOTE: pg_cron must be enabled in your Supabase project
-- Go to Database > Extensions > Enable pg_cron
-- If pg_cron is not available, the application-level opportunistic
-- cleanup in audit.ts will handle it as a fallback.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing schedule if any
    PERFORM cron.unschedule('cleanup-audit-logs');
    -- Schedule daily at 3 AM UTC (8:30 AM IST)
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 3 * * *',
      $$SELECT cleanup_old_audit_logs()$$
    );
    RAISE NOTICE 'pg_cron job scheduled: cleanup-audit-logs (daily at 3 AM UTC)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Relying on application-level cleanup.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Relying on application-level cleanup.', SQLERRM;
END $do$;

-- 4. Run initial cleanup to clear existing old logs
SELECT cleanup_old_audit_logs();
