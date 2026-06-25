-- ============================================================
-- FusionFit Gym Management System — SMS Bridge Migration v12
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Alter sms_logs to match the new SIM Bridge schema
DO $$
BEGIN
  -- Rename phone to phone_number if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'phone') THEN
    ALTER TABLE public.sms_logs RENAME COLUMN phone TO phone_number;
  END IF;

  -- Rename sms_type to message_type if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_logs' AND column_name = 'sms_type') THEN
    ALTER TABLE public.sms_logs RENAME COLUMN sms_type TO message_type;
  END IF;
END $$;

-- Add device_id and sent_at columns
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.sms_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- Drop provider_response if it exists
ALTER TABLE public.sms_logs DROP COLUMN IF EXISTS provider_response;

-- Ensure constraints and types are aligned
ALTER TABLE public.sms_logs ALTER COLUMN phone_number SET NOT NULL;
ALTER TABLE public.sms_logs ALTER COLUMN message_type SET NOT NULL;
ALTER TABLE public.sms_logs ALTER COLUMN message SET NOT NULL;

-- 2. Create Connected SMS Phones Table
CREATE TABLE IF NOT EXISTS public.sms_devices (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  device_model      TEXT NOT NULL,
  android_version   TEXT NOT NULL,
  sim_number        TEXT NOT NULL,
  battery_percentage INTEGER NOT NULL DEFAULT 100,
  signal_strength   TEXT NOT NULL DEFAULT 'Strong',
  last_heartbeat    TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sms_devices ENABLE ROW LEVEL SECURITY;

-- Setup RLS Policies for sms_devices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_devices' AND policyname = 'Allow read access for authenticated users on sms_devices') THEN
    CREATE POLICY "Allow read access for authenticated users on sms_devices" 
      ON public.sms_devices FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_devices' AND policyname = 'Allow all access for authenticated and anon users on sms_devices') THEN
    CREATE POLICY "Allow all access for authenticated and anon users on sms_devices" 
      ON public.sms_devices FOR ALL TO authenticated, anon USING (true);
  END IF;
END $$;

-- 3. Seed Connected SMS Phone
INSERT INTO public.sms_devices (name, device_model, android_version, sim_number, battery_percentage, signal_strength, last_heartbeat)
VALUES (
  'Owner SIM Bridge',
  'Samsung Galaxy S23 Ultra',
  'Android 14',
  '+91 98765 43210',
  85,
  'Excellent',
  NOW()
)
ON CONFLICT DO NOTHING;
