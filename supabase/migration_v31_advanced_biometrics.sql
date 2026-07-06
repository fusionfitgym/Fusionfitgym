-- ============================================================
-- FusionFit Gym Management System — Migration v31
-- Advanced Biometric Verification & eSSL X990 Compatibility
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Modify public.biometric_actions table constraints and add columns
ALTER TABLE public.biometric_actions ALTER COLUMN member_id DROP NOT NULL;

-- Add new columns to biometric_actions
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'member' CHECK (entity_type IN ('member', 'staff'));
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS disable_method TEXT NOT NULL DEFAULT 'block' CHECK (disable_method IN ('block', 'delete'));
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS device_response TEXT;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS verification_result TEXT;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.biometric_actions ADD COLUMN IF NOT EXISTS verification_timestamp TIMESTAMPTZ;

-- Drop old constraints and add new ones
ALTER TABLE public.biometric_actions DROP CONSTRAINT IF EXISTS biometric_actions_status_check;
ALTER TABLE public.biometric_actions ADD CONSTRAINT biometric_actions_status_check CHECK (status IN ('pending', 'sent', 'executing', 'verifying', 'completed', 'failed'));

ALTER TABLE public.biometric_actions DROP CONSTRAINT IF EXISTS biometric_actions_action_check;
ALTER TABLE public.biometric_actions ADD CONSTRAINT biometric_actions_action_check CHECK (action IN ('enable', 'disable', 'verify', 'read'));

-- 2. Modify public.members and public.staff tables for profile status caching
-- Update members table biometric_status CHECK constraint
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_biometric_status_check;
ALTER TABLE public.members ADD CONSTRAINT members_biometric_status_check CHECK (biometric_status IN ('ENABLED', 'DISABLED', 'BLOCKED', 'DELETED', 'PENDING'));

-- Add status details and caching columns to members
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biometric_last_sync TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biometric_last_verification TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biometric_last_device_response TEXT;

-- Add biometric columns to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (biometric_status IN ('ENABLED', 'DISABLED', 'BLOCKED', 'DELETED', 'PENDING'));
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_last_sync TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_last_verification TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_last_device_response TEXT;

-- 3. Create permanent biometric audit log table
CREATE TABLE IF NOT EXISTS public.biometric_audit_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID REFERENCES public.members(id) ON DELETE SET NULL,
  staff_id            UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  entity_type         TEXT CHECK (entity_type IN ('member', 'staff')),
  entity_name         TEXT,
  biometric_id        TEXT,
  action              TEXT NOT NULL, -- 'enable', 'disable', 'verify', 'read'
  device_id           TEXT,
  operator            TEXT,
  timestamp           TIMESTAMPTZ DEFAULT NOW(),
  command             TEXT,
  verification_result TEXT,
  execution_time_ms   INTEGER,
  old_status          TEXT,
  new_status          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Optimize queries with indexes
CREATE INDEX IF NOT EXISTS idx_biometric_audit_logs_timestamp ON public.biometric_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_biometric_audit_logs_member_id ON public.biometric_audit_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_biometric_audit_logs_staff_id ON public.biometric_audit_logs(staff_id);

-- Enable RLS for biometric audit logs
ALTER TABLE public.biometric_audit_logs ENABLE ROW LEVEL SECURITY;

-- Set RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_audit_logs' AND policyname = 'Allow read access for all authenticated users on biometric audit logs'
  ) THEN
    CREATE POLICY "Allow read access for all authenticated users on biometric audit logs" 
      ON public.biometric_audit_logs FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_audit_logs' AND policyname = 'Allow insert access for all users on biometric audit logs'
  ) THEN
    CREATE POLICY "Allow insert access for all users on biometric audit logs" 
      ON public.biometric_audit_logs FOR INSERT TO authenticated, anon WITH CHECK (true);
  END IF;
END $$;

-- 4. Enable Realtime Replication for new tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'biometric_audit_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE biometric_audit_logs;
    END IF;
  END IF;
END $$;
