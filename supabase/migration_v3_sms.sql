-- ============================================================
-- FusionFit Gym Management System — SMS Notification System Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Create SMS Logs Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id          UUID REFERENCES members(id) ON DELETE CASCADE,
  phone              TEXT NOT NULL,
  sms_type           TEXT NOT NULL,
  message            TEXT NOT NULL,
  status             TEXT,
  provider_response  TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Create Indexes for Performance ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_sms_logs_member_id ON sms_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_sms_type ON sms_logs(sms_type);

-- ── 3. Enable Row Level Security (RLS) ───────────────────────
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to prevent errors on re-run
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow read access for authenticated users') THEN
    DROP POLICY "Allow read access for authenticated users" ON sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow insert access for authenticated users') THEN
    DROP POLICY "Allow insert access for authenticated users" ON sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow public read access for anon') THEN
    DROP POLICY "Allow public read access for anon" ON sms_logs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sms_logs' AND policyname = 'Allow public insert access for anon') THEN
    DROP POLICY "Allow public insert access for anon" ON sms_logs;
  END IF;
END
$$;

-- Create policies for select and insert (matching the other dashboard/gate endpoints setup)
CREATE POLICY "Allow read access for authenticated users" 
  ON sms_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access for authenticated users" 
  ON sms_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow public read access for anon" 
  ON sms_logs FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert access for anon" 
  ON sms_logs FOR INSERT TO anon WITH CHECK (true);

-- ── 4. Seed Settings Table for SMS Configurations ───────────
INSERT INTO settings (key, value) VALUES
  ('sms_provider_name', 'Generic HTTP API'),
  ('sms_api_url', ''),
  ('sms_api_key', ''),
  ('sms_sender_id', 'FUSFIT'),
  ('sms_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
