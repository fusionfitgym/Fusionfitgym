-- ============================================================
-- FusionFit Gym Management System — Migration v22
-- Automatic 15-Day Attendance Log Retention Policy
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create clean up function for attendance logs older than 15 days
CREATE OR REPLACE FUNCTION public.cleanup_old_attendance_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attendance_logs
  WHERE punch_time < NOW() - INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Schedule daily cleanup at 2:00 AM UTC using pg_cron if available
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing schedule if any
    PERFORM cron.unschedule('cleanup-attendance-logs');
    -- Schedule daily at 2:00 AM UTC (7:30 AM IST)
    PERFORM cron.schedule(
      'cleanup-attendance-logs',
      '0 2 * * *',
      $$SELECT public.cleanup_old_attendance_logs()$$
    );
    RAISE NOTICE 'pg_cron job scheduled: cleanup-attendance-logs (daily at 2:00 AM UTC)';
  ELSE
    RAISE NOTICE 'pg_cron extension not available. Relying on application-level cleanup.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Relying on application-level cleanup.', SQLERRM;
END $do$;

-- 3. Run initial cleanup to clear existing logs older than 15 days
SELECT public.cleanup_old_attendance_logs();
