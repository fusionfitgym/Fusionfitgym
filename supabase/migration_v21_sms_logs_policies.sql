-- ============================================================
-- FusionFit Gym Management System — SMS Logs RLS Policies Update v21
-- Run this in your Supabase SQL Editor to allow updates and deletions of SMS records
-- ============================================================

-- Ensure Row Level Security (RLS) is enabled on sms_logs
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow read access for authenticated users') THEN
    DROP POLICY "Allow read access for authenticated users" ON public.sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow insert access for authenticated users') THEN
    DROP POLICY "Allow insert access for authenticated users" ON public.sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow public read access for anon') THEN
    DROP POLICY "Allow public read access for anon" ON public.sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow public insert access for anon') THEN
    DROP POLICY "Allow public insert access for anon" ON public.sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow all access for authenticated and anon users on sms_logs') THEN
    DROP POLICY "Allow all access for authenticated and anon users on sms_logs" ON public.sms_logs;
  END IF;
END $$;

-- Create a comprehensive ALL policy for authenticated and anonymous users
CREATE POLICY "Allow all access for authenticated and anon users on sms_logs"
  ON public.sms_logs FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);
