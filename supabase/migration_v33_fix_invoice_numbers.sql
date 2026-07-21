-- 1. Update the regular invoice generation function to safely loop until it finds a unique number.
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix_val TEXT;
  year_val TEXT;
  seq_val BIGINT;
  candidate_number TEXT;
  max_attempts INT := 100;
  attempt INT := 0;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    -- Get prefix from settings
    SELECT value INTO prefix_val FROM public.settings WHERE key = 'invoice_prefix';
    IF prefix_val IS NULL OR prefix_val = '' THEN
      prefix_val := 'INV';
    END IF;

    -- Get current year
    year_val := TO_CHAR(NOW(), 'YYYY');

    LOOP
      attempt := attempt + 1;
      IF attempt > max_attempts THEN
        RAISE EXCEPTION 'Could not generate a unique invoice number after % attempts', max_attempts;
      END IF;

      -- Get next sequence value
      seq_val := nextval('public.invoice_seq');
      
      -- Format: PREFIX-YEAR-6_DIGIT_SEQ (e.g. INV-2026-000001)
      candidate_number := prefix_val || '-' || year_val || '-' || LPAD(seq_val::TEXT, 6, '0');

      -- Check if it exists
      PERFORM 1 FROM public.invoices WHERE invoice_number = candidate_number;
      IF NOT FOUND THEN
        NEW.invoice_number := candidate_number;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update the PT invoice generation function to safely loop.
CREATE OR REPLACE FUNCTION public.generate_pt_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  candidate_number TEXT;
  max_attempts INT := 100;
  attempt INT := 0;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    LOOP
      attempt := attempt + 1;
      IF attempt > max_attempts THEN
        RAISE EXCEPTION 'Could not generate a unique PT invoice number after % attempts', max_attempts;
      END IF;

      seq_val := nextval('public.pt_invoice_seq');
      candidate_number := 'PT-INV-' || LPAD(seq_val::TEXT, 4, '0');

      PERFORM 1 FROM public.pt_invoices WHERE invoice_number = candidate_number;
      IF NOT FOUND THEN
        NEW.invoice_number := candidate_number;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
