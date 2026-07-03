-- Migration v27: Add new columns to members and invoices tables and support advanced settings

-- 1. Add columns to members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS locker_fee NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS diet_plan_fee NUMERIC(10,2) DEFAULT 0 NOT NULL;

-- 2. Add columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS locker_fee NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS diet_plan_fee NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ;

-- 3. Update the check constraint for invoices status
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('Paid', 'Partially Paid', 'Unpaid', 'Pending', 'Overdue', 'Cancelled'));

-- 4. Create sequence reset RPC function
CREATE OR REPLACE FUNCTION public.set_invoice_sequence(start_num INTEGER)
RETURNS VOID AS $$
BEGIN
  IF start_num < 1 THEN
    start_num := 1;
  END IF;
  PERFORM setval('public.invoice_seq', start_num - 1, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create or replace function to auto-generate custom invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix_val TEXT;
  year_val TEXT;
  seq_val BIGINT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    -- Get prefix from settings
    SELECT value INTO prefix_val FROM public.settings WHERE key = 'invoice_prefix';
    IF prefix_val IS NULL OR prefix_val = '' THEN
      prefix_val := 'INV';
    END IF;

    -- Get current year
    year_val := TO_CHAR(NOW(), 'YYYY');

    -- Get next sequence value
    seq_val := nextval('public.invoice_seq');

    -- Format: PREFIX-YEAR-6_DIGIT_SEQ (e.g. INV-2026-000001)
    NEW.invoice_number := prefix_val || '-' || year_val || '-' || LPAD(seq_val::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
