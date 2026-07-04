-- ============================================================
-- FusionFit Gym Management System — Migration v29
-- Membership Expiry & Biometric Access Management Upgrade
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Drop the check constraint restricting duration to specific options
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_duration_check;

-- 2. Add biometric_status column to members table if it does not exist
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS biometric_status TEXT NOT NULL DEFAULT 'ENABLED' CHECK (biometric_status IN ('ENABLED', 'DISABLED'));

-- 3. Add billing period columns to public.invoices table historically
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS membership_start_date DATE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS membership_expiry_date DATE;

-- 4. Create biometric_actions table for pending actions queue
CREATE TABLE IF NOT EXISTS public.biometric_actions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  biometric_id    TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('enable', 'disable')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for high-performance polling
CREATE INDEX IF NOT EXISTS idx_biometric_actions_pending ON public.biometric_actions(status) WHERE status = 'pending';

-- Enable RLS for biometric_actions
ALTER TABLE public.biometric_actions ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for biometric_actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_actions' AND policyname = 'Allow read access for all users on biometric actions'
  ) THEN
    CREATE POLICY "Allow read access for all users on biometric actions" 
      ON public.biometric_actions FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'biometric_actions' AND policyname = 'Allow write access for all users on biometric actions'
  ) THEN
    CREATE POLICY "Allow write access for all users on biometric actions" 
      ON public.biometric_actions FOR ALL TO authenticated, anon USING (true);
  END IF;
END $$;

-- 5. Enable Realtime Replication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'biometric_actions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE biometric_actions;
    END IF;
  END IF;
END $$;
