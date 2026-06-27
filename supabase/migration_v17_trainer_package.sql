-- ============================================================
-- FusionFit Gym Management System — Migration v17
-- Add trainer_package and trainer_fee to public.members and public.invoices
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Add columns to members table if not exists
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS trainer_package BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS trainer_fee NUMERIC(10,2) DEFAULT 0;

-- 2. Add columns to invoices table if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS trainer_fee NUMERIC(10,2) DEFAULT 0;

-- 3. Set defaults for existing members to do migration safely
UPDATE public.members
SET
  trainer_package = COALESCE(trainer_package, FALSE),
  trainer_fee = COALESCE(trainer_fee, 0);

-- 4. Populate trainer_fee for existing invoices historically
UPDATE public.invoices
SET 
  trainer_fee = COALESCE(trainer_fee, 0);

-- 5. Set NOT NULL constraints for future rows
ALTER TABLE public.members ALTER COLUMN trainer_package SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN trainer_fee SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN trainer_fee SET NOT NULL;
