-- Migration: migration_v35_sms_hub_refactor
-- Upgrades sms_logs with provider_message_id tracking and indices for queue processing.

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Create index for status and created_at to optimize queue polling and stats queries
CREATE INDEX IF NOT EXISTS idx_sms_logs_status_created_at
  ON sms_logs (status, created_at DESC);

COMMENT ON COLUMN sms_logs.provider_message_id IS 'Unique message identifier assigned by external provider (e.g. TextBee message ID)';
