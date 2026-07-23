-- ============================================================
-- FusionFit Gym Management System — Migration V40
-- Ensure sms_logs Schema Compatibility for Phone & Type Columns
-- ============================================================

-- Ensure phone, phone_number, sms_type, and message_type columns exist on public.sms_logs
-- to prevent schema cache lookup errors across different migration versions
ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS sms_type TEXT,
  ADD COLUMN IF NOT EXISTS message_type TEXT;

-- Sync values between phone and phone_number if one is missing
UPDATE public.sms_logs
SET phone = phone_number
WHERE phone IS NULL AND phone_number IS NOT NULL;

UPDATE public.sms_logs
SET phone_number = phone
WHERE phone_number IS NULL AND phone IS NOT NULL;

-- Sync values between sms_type and message_type if one is missing
UPDATE public.sms_logs
SET sms_type = message_type
WHERE sms_type IS NULL AND message_type IS NOT NULL;

UPDATE public.sms_logs
SET message_type = sms_type
WHERE message_type IS NULL AND sms_type IS NOT NULL;

