-- ============================================================
-- FusionFit Gym Management System — SMS Logs Resend Fields Migration v20
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add tracking columns for resending messages to the sms_logs table
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS last_resend_at TIMESTAMPTZ;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS resend_count INTEGER DEFAULT 0;
