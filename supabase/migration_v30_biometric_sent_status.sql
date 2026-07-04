-- ============================================================
-- FusionFit Gym Management System — Migration v30
-- Support 'sent' status in Biometric Actions Queue
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Drop the old check constraint on biometric_actions status
ALTER TABLE public.biometric_actions DROP CONSTRAINT IF EXISTS biometric_actions_status_check;

-- 2. Add the updated check constraint that supports 'sent'
ALTER TABLE public.biometric_actions ADD CONSTRAINT biometric_actions_status_check CHECK (status IN ('pending', 'sent', 'completed', 'failed'));
