-- ============================================================
-- FusionFit Gym Management System — Migration v43
-- Member Freeze / Unfreeze Feature
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Add freeze tracking columns to public.members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS freeze_reason TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS freeze_days INT DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS total_frozen_days INT DEFAULT 0;

-- 2. Create member_freezes table for audit & history
CREATE TABLE IF NOT EXISTS public.member_freezes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  freeze_start_date DATE NOT NULL,
  freeze_days INT NOT NULL,
  freeze_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for rapid queries
CREATE INDEX IF NOT EXISTS idx_member_freezes_member_id ON public.member_freezes(member_id);

-- Enable RLS
ALTER TABLE public.member_freezes ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for member_freezes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'member_freezes' AND policyname = 'Allow read access for all users on member_freezes'
  ) THEN
    CREATE POLICY "Allow read access for all users on member_freezes" 
      ON public.member_freezes FOR SELECT TO authenticated, anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'member_freezes' AND policyname = 'Allow write access for all users on member_freezes'
  ) THEN
    CREATE POLICY "Allow write access for all users on member_freezes" 
      ON public.member_freezes FOR ALL TO authenticated, anon USING (true);
  END IF;
END $$;
