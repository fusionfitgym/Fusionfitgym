-- ============================================================
-- FusionFit Gym Management System — Staff Table Migration
-- Version: v23 — Trainers & Janitors
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Enable UUID extension (idempotent) ──────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 2. Create staff table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       TEXT NOT NULL UNIQUE,
  full_name         TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('Trainer', 'Janitor')),
  gender            TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  dob               DATE,
  phone             TEXT NOT NULL,
  email             TEXT,
  address           TEXT,
  emergency_contact TEXT,
  profile_photo     TEXT,
  salary            NUMERIC(10,2),
  joining_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  shift             TEXT CHECK (shift IN ('Morning', 'Evening', 'Night', 'Full Day')),
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  -- Trainer-specific fields
  specialization    TEXT,
  experience        INTEGER,        -- years of experience
  certifications    TEXT,
  -- Janitor-specific fields
  cleaning_area     TEXT,
  working_shift     TEXT,
  -- Shared
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Auto-update updated_at trigger ──────────────────────
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 4. Employee ID auto-generation ─────────────────────────
CREATE SEQUENCE IF NOT EXISTS staff_employee_seq START 1001;

CREATE OR REPLACE FUNCTION generate_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    NEW.employee_id := 'EMP-' || LPAD(nextval('staff_employee_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_employee_id_trigger ON public.staff;
CREATE TRIGGER staff_employee_id_trigger
  BEFORE INSERT ON public.staff
  FOR EACH ROW EXECUTE FUNCTION generate_employee_id();

-- ── 5. Performance indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_role        ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_status      ON public.staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_employee_id ON public.staff(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_full_name   ON public.staff(full_name);
CREATE INDEX IF NOT EXISTS idx_staff_created_at  ON public.staff(created_at DESC);

-- ── 6. Enable Row Level Security ──────────────────────────
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- ── 7. RLS Policies ────────────────────────────────────────

-- All authenticated non-disabled users can view staff
CREATE POLICY "Allow all authenticated users to view staff"
  ON public.staff
  FOR SELECT
  TO authenticated
  USING (NOT public.check_is_user_disabled());

-- Only Super Admin and Admin can create staff
CREATE POLICY "Allow Super Admin and Admin to insert staff"
  ON public.staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

-- Only Super Admin and Admin can update staff
CREATE POLICY "Allow Super Admin and Admin to update staff"
  ON public.staff
  FOR UPDATE
  TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  )
  WITH CHECK (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );

-- Only Super Admin and Admin can delete staff
CREATE POLICY "Allow Super Admin and Admin to delete staff"
  ON public.staff
  FOR DELETE
  TO authenticated
  USING (
    NOT public.check_is_user_disabled() AND
    public.get_current_user_role() IN ('Super Admin', 'Admin')
  );
