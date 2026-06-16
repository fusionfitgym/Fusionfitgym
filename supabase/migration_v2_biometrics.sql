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

-- ── 6. Seed Biometric Mappings for Sample Members ────────────
-- Map biometric device codes to existing test members based on phone numbers
UPDATE members SET device_user_id = '1001', biometric_id = 'BIO-1001' WHERE phone = '+91 98001 11111';
UPDATE members SET device_user_id = '1002', biometric_id = 'BIO-1002' WHERE phone = '+91 98002 22222';
UPDATE members SET device_user_id = '1003', biometric_id = 'BIO-1003' WHERE phone = '+91 98003 33333';
UPDATE members SET device_user_id = '1005', biometric_id = 'BIO-1005' WHERE phone = '+91 98005 55555';
UPDATE members SET device_user_id = '1006', biometric_id = 'BIO-1006' WHERE phone = '+91 98006 66666';

-- ── 7. Seed Demo Attendance Logs ─────────────────────────────
-- Clear any testing logs to allow re-runs of the script cleanly
DELETE FROM attendance_logs;

-- Punch log: Arjun Sharma checked in at 7:00 AM and out at 9:00 AM today
INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '7 hours')::TIMESTAMPTZ, 'checkin'
FROM members WHERE device_user_id = '1001';

INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '9 hours')::TIMESTAMPTZ, 'checkout'
FROM members WHERE device_user_id = '1001';

-- Punch log: Priya Nair checked in at 8:00 AM and out at 10:15 AM today
INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '8 hours')::TIMESTAMPTZ, 'checkin'
FROM members WHERE device_user_id = '1002';

INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '10 hours 15 minutes')::TIMESTAMPTZ, 'checkout'
FROM members WHERE device_user_id = '1002';

-- Punch log: Rahul Verma checked in at 6:00 PM today (remains checked-in)
INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '18 hours')::TIMESTAMPTZ, 'checkin'
FROM members WHERE device_user_id = '1003';

-- Punch log: Vikram Singh checked in at 7:30 PM today (remains checked-in)
INSERT INTO attendance_logs (member_id, member_name, device_user_id, punch_time, punch_type)
SELECT id, full_name, device_user_id, (CURRENT_DATE + INTERVAL '19 hours 30 minutes')::TIMESTAMPTZ, 'checkin'
FROM members WHERE device_user_id = '1005';

