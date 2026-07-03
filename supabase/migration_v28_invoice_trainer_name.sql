-- Migration v28: Add trainer_name column to invoices table

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS trainer_name TEXT;
