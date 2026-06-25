-- Add secure public invoice token for shareable invoice links
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_token TEXT UNIQUE;

-- Backfill tokens for existing invoices
UPDATE public.invoices
SET invoice_token = replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 8)
WHERE invoice_token IS NULL;

-- Auto-generate token on new invoices
CREATE OR REPLACE FUNCTION generate_invoice_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_token IS NULL OR NEW.invoice_token = '' THEN
    NEW.invoice_token := replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_token_trigger ON public.invoices;
CREATE TRIGGER invoice_token_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_token();

CREATE INDEX IF NOT EXISTS idx_invoices_token ON public.invoices(invoice_token);
