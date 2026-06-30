-- ============================================================
-- FusionFit Gym Management System — Migration v18
-- Create backup_history table and setup RLS policies + helpers
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Create backup_history table if it does not exist
CREATE TABLE IF NOT EXISTS public.backup_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename       TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('Success', 'Failed', 'In Progress')),
  size_bytes     BIGINT DEFAULT 0,
  records_count  INTEGER DEFAULT 0,
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  duration_ms    INTEGER DEFAULT 0
);

-- 2. Enable Row Level Security
ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

-- 3. Policy to allow Super Admin and Admin full access to backup history
DROP POLICY IF EXISTS "Allow Admins full access to backup_history" ON public.backup_history;
CREATE POLICY "Allow Admins full access to backup_history" ON public.backup_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users_profiles 
      WHERE auth_user_id = auth.uid() AND role IN ('Super Admin', 'Admin')
    )
  );

-- 4. Create Postgres RPC function to discover public tables dynamically
CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE (table_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name != 'backup_history'; -- Exclude history log table from backup itself
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create Postgres RPC function to truncate all public tables safely (for restore operations)
CREATE OR REPLACE FUNCTION public.truncate_public_tables()
RETURNS void AS $$
DECLARE
  t_name text;
BEGIN
  -- Set replication role to replica to temporarily disable all triggers/foreign keys
  SET session_replication_role = 'replica';
  
  FOR t_name IN
    SELECT table_name::text 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE' 
      AND table_name != 'backup_history'
  LOOP
    EXECUTE format('TRUNCATE TABLE %I CASCADE', t_name);
  END LOOP;
  
  -- Reset replication role to origin
  SET session_replication_role = 'origin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

