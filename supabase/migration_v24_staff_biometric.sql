-- ============================================================
-- FusionFit Gym Management System — Staff Biometrics Migration
-- Version: v24 — Staff Attendance & Biometrics Link
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Add Biometric User ID to Staff Table ──────────────────
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_user_id TEXT UNIQUE;

-- ── 2. Create Staff Attendance Table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_attendance (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id              UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date                  DATE NOT NULL,
  check_in              TIMESTAMPTZ,
  check_out             TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'Present' CHECK (status IN ('Present', 'Late', 'Half Day', 'Absent')),
  working_hours         NUMERIC(5,2),
  overtime_hours        NUMERIC(5,2),
  late_arrival_minutes  INTEGER DEFAULT 0,
  leave_type            TEXT,
  shift                 TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date)
);

-- ── 3. Auto-update updated_at trigger ──────────────────────
CREATE OR REPLACE FUNCTION update_staff_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_attendance_updated_at ON public.staff_attendance;
CREATE TRIGGER staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION update_staff_attendance_updated_at();

-- ── 4. Create indexes for performance ────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_id ON public.staff_attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_status ON public.staff_attendance(status);
CREATE INDEX IF NOT EXISTS idx_staff_biometric_user_id ON public.staff(biometric_user_id);

-- ── 5. Enable Row Level Security ──────────────────────────
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS Policies ────────────────────────────────────────
-- Allow all authenticated users to read staff attendance
CREATE POLICY "Allow all authenticated users to view staff attendance"
  ON public.staff_attendance
  FOR SELECT
  TO authenticated
  USING (NOT public.check_is_user_disabled());

-- Allow Super Admin and Admin to insert/update staff attendance
CREATE POLICY "Allow Super Admin and Admin to insert staff attendance"
  ON public.staff_attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

CREATE POLICY "Allow Super Admin and Admin to update staff attendance"
  ON public.staff_attendance
  FOR UPDATE
  TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  )
  WITH CHECK (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

CREATE POLICY "Allow Super Admin and Admin to delete staff attendance"
  ON public.staff_attendance
  FOR DELETE
  TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

-- Allow anonymous insertion & updating specifically for the biometric sync API
CREATE POLICY "Allow anon insert access for sync"
  ON public.staff_attendance
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update access for sync"
  ON public.staff_attendance
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon select access for sync"
  ON public.staff_attendance
  FOR SELECT
  TO anon
  USING (true);

-- ── 7. Enable Realtime Replication ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'staff_attendance'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE staff_attendance;
    END IF;
  END IF;
END $$;
