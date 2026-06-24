-- ============================================================
-- FusionFit Gym Management System — Migration v10
-- Redesign Biometric ID and Device Management Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Create Biometric Devices Table ─────────────────────────
CREATE TABLE IF NOT EXISTS public.biometric_devices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  serial_number   TEXT NOT NULL UNIQUE,
  ip_address      TEXT,
  status          TEXT NOT NULL DEFAULT 'Online' CHECK (status IN ('Online', 'Offline')),
  last_sync       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with example devices
INSERT INTO public.biometric_devices (name, serial_number, ip_address, status, last_sync) VALUES
  ('Gents Entry', 'NFZ8244803860', '192.168.1.201', 'Online', NOW() - INTERVAL '5 minutes'),
  ('Ladies Entry', 'NFZ8251101886', '192.168.1.202', 'Online', NOW() - INTERVAL '12 minutes')
ON CONFLICT (serial_number) DO NOTHING;

-- Enable RLS for biometric_devices
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for biometric_devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_devices' AND policyname = 'Allow read access for authenticated users on devices'
  ) THEN
    CREATE POLICY "Allow read access for authenticated users on devices" 
      ON public.biometric_devices FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_devices' AND policyname = 'Allow write access for authenticated users on devices'
  ) THEN
    CREATE POLICY "Allow write access for authenticated users on devices" 
      ON public.biometric_devices FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- ── 2. Create Biometric Sync Logs Table (Diagnostics) ─────────
CREATE TABLE IF NOT EXISTS public.biometric_sync_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  biometric_user_id TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('Success', 'Failed')),
  message           TEXT NOT NULL,
  punch_time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for biometric_sync_logs
ALTER TABLE public.biometric_sync_logs ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for biometric_sync_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_sync_logs' AND policyname = 'Allow read access for authenticated users on sync logs'
  ) THEN
    CREATE POLICY "Allow read access for authenticated users on sync logs" 
      ON public.biometric_sync_logs FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_sync_logs' AND policyname = 'Allow insert access for all on sync logs'
  ) THEN
    CREATE POLICY "Allow insert access for all on sync logs" 
      ON public.biometric_sync_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;

-- ── 3. Update Members Table with Biometric Column Changes ──────
-- Rename device_user_id to biometric_user_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='members' AND column_name='device_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='members' AND column_name='biometric_user_id'
  ) THEN
    ALTER TABLE public.members RENAME COLUMN device_user_id TO biometric_user_id;
  END IF;
END $$;

-- ── 4. Update Attendance Logs Table with Biometric Column Changes ──
-- Rename device_user_id to biometric_user_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='attendance_logs' AND column_name='device_user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='attendance_logs' AND column_name='biometric_user_id'
  ) THEN
    ALTER TABLE public.attendance_logs RENAME COLUMN device_user_id TO biometric_user_id;
  END IF;
END $$;

-- ── 5. Data Migration & Compatibility ─────────────────────────
-- Copy raw numeric digits from biometric_id to biometric_user_id if biometric_user_id is null
UPDATE public.members
SET biometric_user_id = regexp_replace(biometric_id, '[^0-9]', '', 'g')
WHERE (biometric_user_id IS NULL OR biometric_user_id = '') AND biometric_id IS NOT NULL;

-- Remove biometric_id column to remove ambiguity
ALTER TABLE public.members DROP COLUMN IF EXISTS biometric_id;

-- ── 6. Indexes Optimization ───────────────────────────────────
DROP INDEX IF EXISTS idx_members_device_user_id;
CREATE INDEX IF NOT EXISTS idx_members_biometric_user_id ON public.members(biometric_user_id);

-- ── 7. Enable Realtime Replication ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- If the table is not already in the publication, add it
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'biometric_sync_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE biometric_sync_logs;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'biometric_devices'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE biometric_devices;
    END IF;
  END IF;
END $$;
