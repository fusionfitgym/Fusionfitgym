-- Migration: migration_v34_textbee_sms_integration
-- Adds provider tracking, idempotency keys, and metadata to SMS logging pipeline.

ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS provider             TEXT,
  ADD COLUMN IF NOT EXISTS provider_metadata    JSONB,
  ADD COLUMN IF NOT EXISTS notification_key     TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count        INTEGER DEFAULT 0;

-- Enforce unique notification_key for non-null values (idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS sms_logs_notification_key_idx
  ON sms_logs (notification_key)
  WHERE notification_key IS NOT NULL;

-- Enable RLS policy checks for these columns if applicable (they are automatically covered by * select/insert)
COMMENT ON COLUMN sms_logs.provider IS 'SMS Gateway Provider name (e.g., textbee, manual)';
COMMENT ON COLUMN sms_logs.provider_metadata IS 'Raw JSON metadata response from provider including httpStatus, messageId, etc.';
COMMENT ON COLUMN sms_logs.notification_key IS 'Idempotency key to prevent double dispatch: {memberId}_{smsType}_{uniqueKey}';
