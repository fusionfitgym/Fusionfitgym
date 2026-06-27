-- ============================================================
-- FusionFit Gym Management System — Migration v16
-- Add admission_fee to public.members and public.invoices
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Add admission_fee column to members table if not exists
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10,2) DEFAULT 0;

-- 2. Add admission_fee column to invoices table if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS admission_fee NUMERIC(10,2) DEFAULT 0;

-- 3. Set NOT NULL constraints for future rows
ALTER TABLE public.members ALTER COLUMN admission_fee SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN admission_fee SET NOT NULL;
