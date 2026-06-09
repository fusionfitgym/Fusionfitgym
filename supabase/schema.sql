-- ============================================================
-- FusionFit Gym Management System — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── Enable UUID extension ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Members ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name        TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  address          TEXT,
  emergency_contact TEXT,
  dob              DATE,
  membership_plan  TEXT NOT NULL DEFAULT 'Monthly',
  join_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status           TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Expired','Frozen')),
  profile_photo    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── PAR-Q Responses ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parq_responses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  answers     JSONB NOT NULL DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Health Assessments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_assessments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  height              NUMERIC(5,2),   -- cm
  weight              NUMERIC(5,2),   -- kg
  bmi                 NUMERIC(4,2),   -- auto calculated
  body_fat            NUMERIC(4,2),   -- %
  injuries            TEXT,
  medical_conditions  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoices ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL UNIQUE,
  amount          NUMERIC(10,2) NOT NULL,
  due_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid','Pending','Overdue')),
  pdf_url         TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key    TEXT UNIQUE NOT NULL,
  value  TEXT NOT NULL
);

-- ── Auto-update updated_at trigger ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Invoice auto-number sequence ───────────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- ── Seed Data ──────────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('gym_name',    'FusionFit Gym'),
  ('gym_phone',   '+91 98765 43210'),
  ('gym_email',   'info@fusionfitgym.com'),
  ('gym_address', '123 Fitness Street, Bangalore, Karnataka 560001'),
  ('plan_monthly',    '1500'),
  ('plan_quarterly',  '4000'),
  ('plan_biannual',   '7500'),
  ('plan_annual',     '14000')
ON CONFLICT (key) DO NOTHING;

INSERT INTO members (full_name, phone, email, address, emergency_contact, dob, membership_plan, join_date, status) VALUES
  ('Arjun Sharma',    '+91 98001 11111', 'arjun@email.com',    '12 MG Road, Bangalore',     '+91 98001 99999', '1990-05-14', 'Monthly',   '2025-01-10', 'Active'),
  ('Priya Nair',      '+91 98002 22222', 'priya@email.com',    '45 Brigade Road, Bangalore','+91 98002 99999', '1995-08-22', 'Quarterly', '2025-02-01', 'Active'),
  ('Rahul Verma',     '+91 98003 33333', 'rahul@email.com',    '78 Koramangala, Bangalore', '+91 98003 99999', '1988-11-30', 'Annual',    '2024-06-15', 'Active'),
  ('Sneha Patel',     '+91 98004 44444', 'sneha@email.com',    '99 Indiranagar, Bangalore', '+91 98004 99999', '1998-03-07', 'Monthly',   '2025-05-01', 'Expired'),
  ('Vikram Singh',    '+91 98005 55555', 'vikram@email.com',   '34 JP Nagar, Bangalore',    '+91 98005 99999', '1992-07-19', 'Biannual',  '2025-01-20', 'Active'),
  ('Kavya Reddy',     '+91 98006 66666', 'kavya@email.com',    '56 HSR Layout, Bangalore',  '+91 98006 99999', '1997-12-25', 'Quarterly', '2025-03-10', 'Active'),
  ('Aditya Kumar',    '+91 98007 77777', 'aditya@email.com',   '21 Whitefield, Bangalore',  '+91 98007 99999', '1985-04-01', 'Annual',    '2024-12-01', 'Frozen'),
  ('Meera Joshi',     '+91 98008 88888', 'meera@email.com',    '67 Jayanagar, Bangalore',   '+91 98008 99999', '2001-09-15', 'Monthly',   '2025-06-01', 'Active'),
  ('Rohan Mehta',     '+91 98009 99999', 'rohan@email.com',    '33 Electronic City, Bangalore','+91 98009 11111','1994-01-28','Monthly', '2025-04-05', 'Inactive'),
  ('Divya Krishnan',  '+91 98010 10101', 'divya@email.com',    '88 Marathahalli, Bangalore','+91 98010 20202', '1996-06-11', 'Annual',    '2025-02-14', 'Active');
