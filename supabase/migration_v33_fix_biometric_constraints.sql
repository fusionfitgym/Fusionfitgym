-- ============================================================
-- FusionFit Gym Management System — Migration v33
-- Fix Biometric User ID Constraints
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Convert existing empty strings in biometric_user_id to NULL
-- This prevents unique constraint violations when multiple users have no biometric ID
UPDATE public.members 
SET biometric_user_id = NULL 
WHERE biometric_user_id = '';

-- 2. Drop the old unique constraints that prevent the same ID on different machines
ALTER TABLE public.members 
DROP CONSTRAINT IF EXISTS members_device_user_id_key,
DROP CONSTRAINT IF EXISTS members_biometric_id_key,
DROP CONSTRAINT IF EXISTS members_biometric_user_id_key;

-- 3. Add a composite unique constraint to allow the same ID across different machines
-- Note: NULLs are not considered equal in Postgres, so multiple users can have NULL
ALTER TABLE public.members 
ADD CONSTRAINT unique_biometric_per_machine UNIQUE (biometric_user_id, machine_type);
