-- ============================================================
-- FusionFit Gym Management System — Migration v14
-- Add package details and fees to public.members and public.invoices
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Add columns to members table if not exists
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('Gents', 'Ladies'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS duration TEXT CHECK (duration IN ('Daily Pass', '1 Month', '3 Months', '6 Months'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS training_type TEXT CHECK (training_type IN ('Weight Training Only', 'Weight Training + Cardio', 'Weight Training + Strength Training'));
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS membership_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS parq_purchased BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS parq_fee NUMERIC(10,2) DEFAULT 0;

-- 2. Add columns to invoices table if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS membership_fee NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parq_fee NUMERIC(10,2) DEFAULT 0;

-- 3. Set defaults for existing members to do migration safely
UPDATE public.members
SET
  gender = COALESCE(gender, 'Gents'),
  duration = COALESCE(
    duration,
    CASE 
      WHEN package_duration = '3 Months' OR membership_plan = 'Quarterly' THEN '3 Months'
      WHEN package_duration = '6 Months' OR membership_plan = 'Biannual' THEN '6 Months'
      WHEN package_duration = '1 Year' OR membership_plan = 'Annual' THEN '6 Months'
      ELSE '1 Month'
    END
  ),
  training_type = COALESCE(training_type, 'Weight Training + Cardio'),
  parq_purchased = COALESCE(parq_purchased, FALSE),
  parq_fee = COALESCE(parq_fee, 0)
WHERE gender IS NULL OR duration IS NULL OR training_type IS NULL;

-- Calculate membership_fee for all existing members based on gender, duration and training_type
UPDATE public.members
SET
  membership_fee = CASE
    WHEN duration = 'Daily Pass' THEN 50
    WHEN gender = 'Ladies' THEN
      CASE
        WHEN duration = '1 Month' AND training_type = 'Weight Training Only' THEN 1000
        WHEN duration = '1 Month' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 1300
        WHEN duration = '3 Months' AND training_type = 'Weight Training Only' THEN 2750
        WHEN duration = '3 Months' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 3600
        WHEN duration = '6 Months' AND training_type = 'Weight Training Only' THEN 5800
        WHEN duration = '6 Months' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 7300
        ELSE 1300
      END
    ELSE -- Gents
      CASE
        WHEN duration = '1 Month' AND training_type = 'Weight Training Only' THEN 1000
        WHEN duration = '1 Month' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 1300
        WHEN duration = '3 Months' AND training_type = 'Weight Training Only' THEN 2850
        WHEN duration = '3 Months' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 3750
        WHEN duration = '6 Months' AND training_type = 'Weight Training Only' THEN 5750
        WHEN duration = '6 Months' AND (training_type = 'Weight Training + Cardio' OR training_type = 'Weight Training + Strength Training') THEN 7500
        ELSE 1300
      END
  END
WHERE membership_fee = 0 OR membership_fee IS NULL;

-- Compute package_price, package_name, package_duration from structured fields
UPDATE public.members
SET
  package_price = membership_fee + parq_fee,
  package_name = CASE
    WHEN duration = 'Daily Pass' THEN 'Daily Pass'
    ELSE gender || ' - ' || duration || ' - ' || training_type
  END,
  package_duration = duration;

-- 4. Apply NOT NULL constraints for future rows
ALTER TABLE public.members ALTER COLUMN gender SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN duration SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN training_type SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN membership_fee SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN parq_purchased SET NOT NULL;
ALTER TABLE public.members ALTER COLUMN parq_fee SET NOT NULL;

-- 5. Populate membership_fee and parq_fee for existing invoices historically
UPDATE public.invoices
SET 
  membership_fee = COALESCE(membership_fee, amount),
  parq_fee = COALESCE(parq_fee, 0);

ALTER TABLE public.invoices ALTER COLUMN membership_fee SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN parq_fee SET NOT NULL;
