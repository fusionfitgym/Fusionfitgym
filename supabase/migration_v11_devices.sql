-- ============================================================
-- FusionFit Gym Management System — Migration v11
-- Schema Definition for Sync Agent Devices and Attendance Logs
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Update Attendance Logs Table ──────────────────────────
-- Add device_id column to track which terminal pushed the punches
ALTER TABLE public.attendance_logs ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Create index on device_id for fast filtering on the attendance history
CREATE INDEX IF NOT EXISTS idx_attendance_logs_device_id ON public.attendance_logs(device_id);


-- ── 2. Create Devices Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_name              TEXT NOT NULL,
  device_id                TEXT UNIQUE NOT NULL, -- Serial Number of ZKTeco/eSSL device
  device_ip                TEXT,
  device_port              INTEGER,
  status                   TEXT DEFAULT 'Offline',
  users_count              INTEGER DEFAULT 0,
  last_seen                TIMESTAMPTZ DEFAULT NOW(),
  lastheartbeat            TIMESTAMPTZ,
  lastattendancereceived   TIMESTAMPTZ,
  latency                  INTEGER,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on device_id and device_name for performance
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_name ON public.devices(device_name);


-- ── 3. Row Level Security (RLS) Policies ─────────────────────
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Read access policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'devices' AND policyname = 'Allow read access for all users'
  ) THEN
    CREATE POLICY "Allow read access for all users" 
      ON public.devices FOR SELECT USING (true);
  END IF;

  -- Write/All access policy (for both authenticated admin dashboard and anon sync agents)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'devices' AND policyname = 'Allow all write operations for all'
  ) THEN
    CREATE POLICY "Allow all write operations for all" 
      ON public.devices FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── 4. Enable Realtime Replication ───────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'devices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE devices;
    END IF;
  END IF;
END $$;
