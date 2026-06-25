-- ============================================================
-- FusionFit Gym Management System — Migration v11
-- Schema Definition for Sync Agent Devices and Attendance Logs
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Create Devices Table (If not exists) ──────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name              TEXT NOT NULL,
  device_id                TEXT UNIQUE NOT NULL, -- Serial Number of biometric terminal
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Add Missing Columns Safely (If they don't exist) ─────
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS device_ip TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS device_port INTEGER;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Offline';
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS users_count INTEGER DEFAULT 0;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS lastheartbeat TIMESTAMPTZ;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS lastattendancereceived TIMESTAMPTZ;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS latency INTEGER;

-- ── 3. Optimize with Indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_name ON public.devices(device_name);

-- ── 4. Update Attendance Logs Table ──────────────────────────
-- Ensure device_id column exists
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_logs_device_id ON public.attendance_logs(device_id);

-- ── 5. Setup Row Level Security (RLS) and Policies ────────────
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Devices Policies
DROP POLICY IF EXISTS "Allow read access for all users" ON public.devices;
DROP POLICY IF EXISTS "Allow all write operations for all" ON public.devices;
DROP POLICY IF EXISTS "Allow read access for all" ON public.devices;
DROP POLICY IF EXISTS "Allow write access for all" ON public.devices;

CREATE POLICY "Allow read access for all" ON public.devices FOR SELECT USING (true);
CREATE POLICY "Allow write access for all" ON public.devices FOR ALL USING (true);

-- Attendance Logs Policies
DROP POLICY IF EXISTS "Allow public insert access" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow insert access for all roles" ON public.attendance_logs;

CREATE POLICY "Allow read access for all" ON public.attendance_logs FOR SELECT USING (true);
CREATE POLICY "Allow insert access for all roles" ON public.attendance_logs FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ── 6. Enable Realtime Replication for Devices ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Add devices table to realtime publication if not already present
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'devices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE devices;
    END IF;
  END IF;
END $$;
