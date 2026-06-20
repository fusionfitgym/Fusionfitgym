-- ============================================================
-- FusionFit Gym Management System — Migration v5
-- Rename user_profiles to users_profiles, add columns, and fix security
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Rename the table if it exists under the old name
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
    ALTER TABLE public.user_profiles RENAME TO users_profiles;
  END IF;
END $$;

-- 2. Create the table if it does not exist under either name
CREATE TABLE IF NOT EXISTS public.users_profiles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  email        TEXT UNIQUE,
  phone        TEXT,
  role         TEXT NOT NULL CHECK (role IN ('Super Admin', 'Admin', 'Receptionist', 'Trainer')),
  status       TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Row Level Security is enabled
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Add new columns to users_profiles if they do not exist
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended'));
ALTER TABLE public.users_profiles ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Migrate disabled boolean status to the new status column if disabled exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users_profiles' AND column_name = 'disabled') THEN
    UPDATE public.users_profiles SET status = 'Suspended' WHERE disabled = TRUE;
    ALTER TABLE public.users_profiles DROP COLUMN disabled;
  END IF;
END $$;

-- 5. Recreate security functions targeting the renamed table
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role 
  FROM public.users_profiles 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users_profiles 
    WHERE auth_user_id = auth.uid() AND role = 'Super Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_user_disabled()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE((
    SELECT status = 'Suspended' FROM public.users_profiles 
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ), FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Drop old policies and recreate them on the renamed table
DROP POLICY IF EXISTS "Allow users to read own profile" ON public.users_profiles;
DROP POLICY IF EXISTS "Allow Super Admins full access to profiles" ON public.users_profiles;

CREATE POLICY "Allow users to read own profile" ON public.users_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Allow Super Admins full access to profiles" ON public.users_profiles
  FOR ALL TO authenticated
  USING (public.check_is_super_admin());

-- 7. Recreate the trigger function and trigger for auto-profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users_profiles (auth_user_id, email, full_name, role, phone, status, notes)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', SPLIT_PART(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Trainer'),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'status', 'Active'),
    COALESCE(new.raw_user_meta_data->>'notes', '')
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users_profiles.full_name),
    role = COALESCE(EXCLUDED.role, users_profiles.role),
    phone = COALESCE(EXCLUDED.phone, users_profiles.phone),
    status = COALESCE(EXCLUDED.status, users_profiles.status),
    notes = COALESCE(EXCLUDED.notes, users_profiles.notes),
    updated_at = NOW();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Establish direct foreign key constraint on audit_logs for clean Supabase joins
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users_profiles(auth_user_id)
  ON DELETE SET NULL;
