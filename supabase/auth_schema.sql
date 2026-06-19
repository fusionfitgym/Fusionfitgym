-- ============================================================
-- FusionFit Gym Management System — Auth & RBAC Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Ensure pgcrypto is enabled for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- Enable RLS on existing tables first
ALTER TABLE IF EXISTS members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS parq_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS health_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;

-- ── 1. Create User Profiles Table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  email        TEXT UNIQUE,
  role         TEXT NOT NULL CHECK (role IN ('Super Admin', 'Admin', 'Receptionist', 'Trainer')),
  disabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- ── 2. Create Audit Logs Table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  module     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ── 3. Helper Functions for RLS (Bypassing Recursion) ───────

-- SECURITY DEFINER function to fetch user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role 
  FROM public.user_profiles 
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SECURITY DEFINER function to check if current user is Super Admin
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE auth_user_id = auth.uid() AND role = 'Super Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SECURITY DEFINER function to check if current user is disabled
CREATE OR REPLACE FUNCTION public.check_is_user_disabled()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE((
    SELECT disabled FROM public.user_profiles 
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ), FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 4. RLS Policies for user_profiles ────────────────────────

CREATE POLICY "Allow users to read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Allow Super Admins full access to profiles" ON public.user_profiles
  FOR ALL TO authenticated
  USING (public.check_is_super_admin());

-- ── 5. RLS Policies for audit_logs ───────────────────────────

CREATE POLICY "Allow authenticated users to insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Allow Super Admins to view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.check_is_super_admin());

-- ── 6. RLS Policies for members ─────────────────────────────

CREATE POLICY "Allow authenticated users to select members" ON public.members
  FOR SELECT TO authenticated
  USING (NOT public.check_is_user_disabled());

CREATE POLICY "Allow all authorized roles to write members" ON public.members
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist', 'Trainer')
  )
  WITH CHECK (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist', 'Trainer')
  );

-- ── 7. RLS Policies for attendance_logs ──────────────────────

CREATE POLICY "Allow Admin, Super Admin, Receptionist access to attendance" ON public.attendance_logs
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist')
  );

-- ── 8. RLS Policies for invoices ─────────────────────────────

CREATE POLICY "Allow Admin, Super Admin, Receptionist access to invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist')
  );

-- ── 9. RLS Policies for health_assessments ───────────────────

CREATE POLICY "Allow Trainer, Admin, Super Admin access to health assessments" ON public.health_assessments
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Trainer')
  );

-- ── 10. RLS Policies for parq_responses ──────────────────────

CREATE POLICY "Allow Trainer, Admin, Super Admin access to PAR-Q" ON public.parq_responses
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Trainer')
  );

-- ── 11. RLS Policies for settings ────────────────────────────

CREATE POLICY "Allow authenticated users to read settings" ON public.settings
  FOR SELECT TO authenticated
  USING (NOT public.check_is_user_disabled());

CREATE POLICY "Allow Admin, Super Admin to write settings" ON public.settings
  FOR ALL TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

-- ── 12. Trigger to auto-create user_profiles from auth.users ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (auth_user_id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', SPLIT_PART(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'Trainer')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 13. Seed Test Users in auth.users & auth.identities ───────

-- We create seeded users using the pgcrypto extension to encrypt their passwords.
-- Note: All seeded users will have the password 'password123'
-- To prevent 'Database error querying schema' during Supabase Auth (GoTrue) login,
-- we must insert matching records in auth.identities table for email sign-ins.

-- First delete the invalid seeded users if any
DELETE FROM auth.users WHERE email IN ('superadmin@fusionfit.com', 'admin@fusionfit.com', 'receptionist@fusionfit.com', 'trainer@fusionfit.com');

-- Seed Super Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'superadmin@fusionfit.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Super Admin User","role":"Super Admin"}',
  NOW(),
  NOW(),
  FALSE
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"superadmin@fusionfit.com"}',
  'email',
  'superadmin@fusionfit.com',
  NOW(),
  NOW(),
  NOW()
);

-- Seed Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-2222-2222-222222222222',
  'authenticated',
  'authenticated',
  'admin@fusionfit.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Admin User","role":"Admin"}',
  NOW(),
  NOW(),
  FALSE
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{"sub":"22222222-2222-2222-2222-222222222222","email":"admin@fusionfit.com"}',
  'email',
  'admin@fusionfit.com',
  NOW(),
  NOW(),
  NOW()
);

-- Seed Receptionist
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-3333-3333-333333333333',
  'authenticated',
  'authenticated',
  'receptionist@fusionfit.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Receptionist User","role":"Receptionist"}',
  NOW(),
  NOW(),
  FALSE
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '33333333-3333-3333-3333-333333333333',
  '{"sub":"33333333-3333-3333-3333-333333333333","email":"receptionist@fusionfit.com"}',
  'email',
  'receptionist@fusionfit.com',
  NOW(),
  NOW(),
  NOW()
);

-- Seed Trainer
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '44444444-4444-4444-4444-444444444444',
  'authenticated',
  'authenticated',
  'trainer@fusionfit.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Trainer User","role":"Trainer"}',
  NOW(),
  NOW(),
  FALSE
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '44444444-4444-4444-4444-444444444444',
  '{"sub":"44444444-4444-4444-4444-444444444444","email":"trainer@fusionfit.com"}',
  'email',
  'trainer@fusionfit.com',
  NOW(),
  NOW(),
  NOW()
);
