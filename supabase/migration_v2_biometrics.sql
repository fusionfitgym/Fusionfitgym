-- ============================================================
-- FusionFit Gym Management System — Biometrics Upgrade Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Update Members Table with Biometric Fields ────────────
ALTER TABLE members ADD COLUMN IF NOT EXISTS biometric_id TEXT UNIQUE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS device_user_id TEXT UNIQUE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'Active';
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_checkin TIMESTAMPTZ;

-- ── 2. Create Attendance Logs Table ──────────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_name     TEXT NOT NULL,
  device_user_id  TEXT NOT NULL,
  punch_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  punch_type      TEXT NOT NULL CHECK (punch_type IN ('checkin', 'checkout')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Optimize with Indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_device_user_id ON members(device_user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_punch_time ON attendance_logs(punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_member_id ON attendance_logs(member_id);

-- ── 4. Set up Row Level Security (RLS) ───────────────────────
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- If policy exists, drop it to prevent duplication errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance_logs' AND policyname = 'Allow read access for authenticated users'
  ) THEN
    CREATE POLICY "Allow read access for authenticated users" 
      ON attendance_logs FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance_logs' AND policyname = 'Allow insert access for authenticated users'
  ) THEN
    CREATE POLICY "Allow insert access for authenticated users" 
      ON attendance_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  -- Allow public access for API endpoint insertions (we secure via API key header in route.ts)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'attendance_logs' AND policyname = 'Allow public insert access'
  ) THEN
    CREATE POLICY "Allow public insert access" 
      ON attendance_logs FOR INSERT TO anon USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- ── 5. Enable Realtime Replication ──────────────────────────
-- Check if publication exists and add the table to it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendance_logs;
  END IF;
END $$;
