-- ============================================================
-- FusionFit Gym Management System — Member SMS Status Migration v19
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add SMS tracking columns to the members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sms_sent BOOLEAN DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sms_sent_at TIMESTAMPTZ;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS sms_status TEXT DEFAULT 'pending';
