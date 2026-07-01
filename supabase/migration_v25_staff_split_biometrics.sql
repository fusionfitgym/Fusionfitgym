-- ============================================================
-- FusionFit Gym Management System — Split Staff Biometrics
-- Version: v25 — Gents & Ladies Biometric ID Split
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- ── 1. Add Gents & Ladies Biometric ID Columns ──────────────
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_gents_id TEXT UNIQUE;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS biometric_ladies_id TEXT UNIQUE;

-- ── 2. Migrate Existing Single Biometric ID Values ────────────
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name='staff' AND column_name='biometric_user_id'
  ) THEN
    UPDATE public.staff 
    SET biometric_gents_id = biometric_user_id,
        biometric_ladies_id = biometric_user_id
    WHERE biometric_user_id IS NOT NULL AND biometric_user_id != '';
  END IF;
END $$;

-- ── 3. Drop Old Single Biometric Column ───────────────────────
ALTER TABLE public.staff DROP COLUMN IF EXISTS biometric_user_id;

-- ── 4. Create Indexes for Quick Lookups ───────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_biometric_gents_id ON public.staff(biometric_gents_id) WHERE biometric_gents_id IS NOT NULL AND biometric_gents_id != '';
CREATE INDEX IF NOT EXISTS idx_staff_biometric_ladies_id ON public.staff(biometric_ladies_id) WHERE biometric_ladies_id IS NOT NULL AND biometric_ladies_id != '';
