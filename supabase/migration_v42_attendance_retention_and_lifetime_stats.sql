-- ============================================================
-- FusionFit Gym Management System — Migration v42
-- Attendance Data 30-Day Retention & Lifetime Member Statistics
-- ============================================================

-- ── 1. Add Lifetime Attendance Statistics Columns to `members` ─
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS total_visits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_visit TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_visit TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0;

-- ── 2. Create Monthly Summary Table: `attendance_monthly_stats` ─
CREATE TABLE IF NOT EXISTS public.attendance_monthly_stats (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  visit_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unq_attendance_monthly_member_year_month UNIQUE (member_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_att_monthly_member ON public.attendance_monthly_stats(member_id);

-- Enable RLS
ALTER TABLE public.attendance_monthly_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select attendance_monthly_stats" ON public.attendance_monthly_stats;
CREATE POLICY "Allow select attendance_monthly_stats" ON public.attendance_monthly_stats
  FOR SELECT TO authenticated USING (NOT public.check_is_user_disabled());

-- ── 3. Trigger Function: Update Member Lifetime & Monthly Stats on Check-In ─
CREATE OR REPLACE FUNCTION public.handle_attendance_checkin_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_member_id UUID;
  v_punch_time TIMESTAMPTZ;
  v_punch_date DATE;
  v_last_visit_date DATE;
  v_year INTEGER;
  v_month INTEGER;
  v_already_checked_in_today BOOLEAN := FALSE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Determine member_id
  v_member_id := NEW.member_id;

  -- Only process for valid checkins
  IF NEW.punch_type = 'checkout' THEN
    RETURN NEW;
  END IF;

  IF v_member_id IS NULL AND NEW.biometric_user_id IS NOT NULL THEN
    SELECT id INTO v_member_id
    FROM public.members
    WHERE biometric_user_id = NEW.biometric_user_id
    LIMIT 1;
  END IF;

  IF v_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_punch_time := COALESCE(NEW.punch_time, NEW.created_at, NOW());
  -- Extract date in IST (+5:30)
  v_punch_date := ((v_punch_time AT TIME ZONE 'UTC') + INTERVAL '5 hours 30 minutes')::DATE;
  v_year := EXTRACT(YEAR FROM v_punch_date);
  v_month := EXTRACT(MONTH FROM v_punch_date);

  -- Fetch member's last_visit, current_streak, longest_streak
  SELECT 
    CASE WHEN last_visit IS NOT NULL THEN ((last_visit AT TIME ZONE 'UTC') + INTERVAL '5 hours 30 minutes')::DATE ELSE NULL END,
    COALESCE(current_streak, 0),
    COALESCE(longest_streak, 0)
  INTO 
    v_last_visit_date,
    v_current_streak,
    v_longest_streak
  FROM public.members
  WHERE id = v_member_id;

  -- Check if member has already checked in on this calendar date (IST)
  IF v_last_visit_date IS NOT NULL AND v_last_visit_date = v_punch_date THEN
    v_already_checked_in_today := TRUE;
  END IF;

  -- If this is a new visit day (not duplicate check-in on same day)
  IF NOT v_already_checked_in_today THEN
    -- Calculate streak
    IF v_last_visit_date IS NULL THEN
      v_current_streak := 1;
    ELSIF v_last_visit_date = v_punch_date - INTERVAL '1 day' THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;

    IF v_current_streak > v_longest_streak THEN
      v_longest_streak := v_current_streak;
    END IF;

    -- Update member stats
    UPDATE public.members
    SET 
      total_visits = total_visits + 1,
      first_visit = COALESCE(first_visit, v_punch_time),
      last_visit = v_punch_time,
      current_streak = v_current_streak,
      longest_streak = v_longest_streak,
      last_checkin = v_punch_time
    WHERE id = v_member_id;

    -- Upsert monthly stats
    INSERT INTO public.attendance_monthly_stats (member_id, year, month, visit_count)
    VALUES (v_member_id, v_year, v_month, 1)
    ON CONFLICT (member_id, year, month)
    DO UPDATE SET 
      visit_count = public.attendance_monthly_stats.visit_count + 1,
      updated_at = NOW();
  ELSE
    -- If already checked in today, just update last_visit if newer
    UPDATE public.members
    SET 
      last_visit = GREATEST(COALESCE(last_visit, v_punch_time), v_punch_time),
      last_checkin = GREATEST(COALESCE(last_checkin, v_punch_time), v_punch_time)
    WHERE id = v_member_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and attach trigger
DROP TRIGGER IF EXISTS trigger_attendance_checkin_stats ON public.attendance_logs;
CREATE TRIGGER trigger_attendance_checkin_stats
  AFTER INSERT ON public.attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_attendance_checkin_stats();

-- ── 4. Automatic 30-Day Cleanup Function & Schedule ──────────
CREATE OR REPLACE FUNCTION public.cleanup_old_attendance_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attendance_logs
  WHERE created_at < NOW() - INTERVAL '30 days'
     OR punch_time < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule daily at 2:00 AM UTC using pg_cron if available
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-attendance-logs');
    PERFORM cron.schedule(
      'cleanup-attendance-logs',
      '0 2 * * *',
      $$SELECT public.cleanup_old_attendance_logs()$$
    );
    RAISE NOTICE 'pg_cron job scheduled: cleanup-attendance-logs (daily at 2:00 AM UTC for 30-day retention)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule pg_cron job: %. Relying on application-level cleanup.', SQLERRM;
END $do$;

-- ── 5. Backfill Existing Data from Current `attendance_logs` ─
DO $$
DECLARE
  rec RECORD;
  m_id UUID;
  p_date DATE;
  prev_date DATE := NULL;
  curr_streak INTEGER := 0;
  max_streak INTEGER := 0;
  tot_visits INTEGER := 0;
  f_visit TIMESTAMPTZ := NULL;
  l_visit TIMESTAMPTZ := NULL;
  y INT;
  m INT;
BEGIN
  FOR m_id IN SELECT id FROM public.members LOOP
    prev_date := NULL;
    curr_streak := 0;
    max_streak := 0;
    tot_visits := 0;
    f_visit := NULL;
    l_visit := NULL;

    FOR rec IN 
      SELECT 
        id, 
        punch_time, 
        created_at,
        ((COALESCE(punch_time, created_at) AT TIME ZONE 'UTC') + INTERVAL '5 hours 30 minutes')::DATE as IST_DATE
      FROM public.attendance_logs
      WHERE (member_id = m_id::TEXT OR member_id = (SELECT biometric_user_id FROM public.members WHERE id = m_id))
        AND (punch_type IS NULL OR punch_type = 'checkin')
      ORDER BY COALESCE(punch_time, created_at) ASC
    LOOP
      p_date := rec.IST_DATE;
      IF f_visit IS NULL THEN
        f_visit := COALESCE(rec.punch_time, rec.created_at);
      END IF;
      l_visit := COALESCE(rec.punch_time, rec.created_at);

      IF prev_date IS NULL THEN
        tot_visits := 1;
        curr_streak := 1;
        max_streak := 1;
        prev_date := p_date;
      ELSIF p_date = prev_date THEN
        -- Same day, skip increment
        NULL;
      ELSIF p_date = prev_date + INTERVAL '1 day' THEN
        tot_visits := tot_visits + 1;
        curr_streak := curr_streak + 1;
        IF curr_streak > max_streak THEN
          max_streak := curr_streak;
        END IF;
        prev_date := p_date;
      ELSE
        tot_visits := tot_visits + 1;
        curr_streak := 1;
        IF curr_streak > max_streak THEN
          max_streak := curr_streak;
        END IF;
        prev_date := p_date;
      END IF;

      -- Populate monthly stats
      y := EXTRACT(YEAR FROM p_date);
      m := EXTRACT(MONTH FROM p_date);

      INSERT INTO public.attendance_monthly_stats (member_id, year, month, visit_count)
      VALUES (m_id, y, m, 1)
      ON CONFLICT (member_id, year, month)
      DO UPDATE SET visit_count = public.attendance_monthly_stats.visit_count + 1;
    END LOOP;

    IF tot_visits > 0 THEN
      UPDATE public.members
      SET 
        total_visits = GREATEST(total_visits, tot_visits),
        first_visit = COALESCE(first_visit, f_visit),
        last_visit = GREATEST(COALESCE(last_visit, l_visit), l_visit),
        current_streak = GREATEST(current_streak, curr_streak),
        longest_streak = GREATEST(longest_streak, max_streak)
      WHERE id = m_id;
    END IF;
  END LOOP;
END $$;
