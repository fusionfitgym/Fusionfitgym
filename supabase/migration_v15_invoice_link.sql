-- ====================================================================
-- Migration: Add secure shareable invoice link column
-- Run this script in the Supabase SQL Editor (https://supabase.com)
-- ====================================================================

-- 1. Add invoice_token column if it does not exist (ensure compatibility with legacy migrations)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_token TEXT UNIQUE;

-- 2. Add invoice_link column to store the public URL
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_link TEXT;

-- 3. Backfill invoice_token for existing invoices that do not have one
UPDATE public.invoices
SET invoice_token = replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 8)
WHERE invoice_token IS NULL;

-- 4. Create or replace function to auto-generate token on new invoices
CREATE OR REPLACE FUNCTION generate_invoice_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_token IS NULL OR NEW.invoice_token = '' THEN
    NEW.invoice_token := replace(gen_random_uuid()::text, '-', '') || substr(md5(random()::text), 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach the trigger to auto-generate invoice_token
DROP TRIGGER IF EXISTS invoice_token_trigger ON public.invoices;
CREATE TRIGGER invoice_token_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_token();

-- 6. Add index on invoice_token for fast lookup on public route
CREATE INDEX IF NOT EXISTS idx_invoices_token ON public.invoices(invoice_token);
CREATE INDEX IF NOT EXISTS idx_invoices_link ON public.invoices(invoice_link);
