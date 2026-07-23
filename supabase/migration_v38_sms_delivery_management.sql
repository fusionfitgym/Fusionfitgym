-- ============================================================
-- FusionFit Gym Management System — Migration V38
-- Enterprise SMS Delivery Management, Auto-Retry & Error Analytics
-- ============================================================

-- Ensure sms_logs table exists and has all required fields
ALTER TABLE public.sms_logs
  ADD COLUMN IF NOT EXISTS member_name          TEXT,
  ADD COLUMN IF NOT EXISTS phone_number         TEXT,
  ADD COLUMN IF NOT EXISTS message_type         TEXT,
  ADD COLUMN IF NOT EXISTS invoice_id           UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gateway              TEXT DEFAULT 'textbee',
  ADD COLUMN IF NOT EXISTS error_message        TEXT,
  ADD COLUMN IF NOT EXISTS http_status          INTEGER,
  ADD COLUMN IF NOT EXISTS textbee_message_id   TEXT,
  ADD COLUMN IF NOT EXISTS retry_count          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failure_category     TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS auto_retry_eligible  BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ DEFAULT NOW();

-- Create Indexes for fast querying, filtering & real-time analytics
CREATE INDEX IF NOT EXISTS idx_sms_logs_status_created_at
  ON public.sms_logs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_failure_category
  ON public.sms_logs(failure_category) WHERE status = 'Failed';

CREATE INDEX IF NOT EXISTS idx_sms_logs_auto_retry
  ON public.sms_logs(auto_retry_eligible, status, retry_count) WHERE status = 'Failed';

CREATE INDEX IF NOT EXISTS idx_sms_logs_invoice_id
  ON public.sms_logs(invoice_id) WHERE invoice_id IS NOT NULL;

-- Trigger to auto-update updated_at on sms_logs update
CREATE OR REPLACE FUNCTION update_sms_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_logs_updated_at ON public.sms_logs;
CREATE TRIGGER trg_sms_logs_updated_at
  BEFORE UPDATE ON public.sms_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_logs_updated_at();

-- Comment on key columns
COMMENT ON COLUMN public.sms_logs.failure_category IS 'Classification: temporary (offline, timeout, 5xx) vs permanent (invalid phone, 400)';
COMMENT ON COLUMN public.sms_logs.auto_retry_eligible IS 'Flag determining if message can be picked up by automated retry background queue';
