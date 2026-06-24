-- ============================================================
-- FusionFit Gym Management System — Migration v9
-- Add direct package columns to public.members and migrate data
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- 1. Add direct package columns to public.members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_duration TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_price NUMERIC(10,2);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_start_date DATE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_end_date DATE;

-- 2. Migrate existing members data to populate direct package columns
UPDATE public.members
SET 
  package_name = COALESCE(membership_plan, 'Monthly'),
  package_duration = CASE 
    WHEN membership_plan = 'Monthly' THEN '1 Month'
    WHEN membership_plan = 'Quarterly' THEN '3 Months'
    WHEN membership_plan = 'Biannual' THEN '6 Months'
    WHEN membership_plan = 'Annual' THEN '1 Year'
    ELSE '1 Month'
  END,
  package_price = CASE 
    WHEN membership_plan = 'Monthly' THEN 1500
    WHEN membership_plan = 'Quarterly' THEN 4000
    WHEN membership_plan = 'Biannual' THEN 7500
    WHEN membership_plan = 'Annual' THEN 14000
    ELSE 1500
  END,
  package_start_date = COALESCE(join_date, CURRENT_DATE),
  package_end_date = CASE 
    WHEN membership_plan = 'Monthly' THEN COALESCE(join_date, CURRENT_DATE) + INTERVAL '1 month'
    WHEN membership_plan = 'Quarterly' THEN COALESCE(join_date, CURRENT_DATE) + INTERVAL '3 months'
    WHEN membership_plan = 'Biannual' THEN COALESCE(join_date, CURRENT_DATE) + INTERVAL '6 months'
    WHEN membership_plan = 'Annual' THEN COALESCE(join_date, CURRENT_DATE) + INTERVAL '1 year'
    ELSE COALESCE(join_date, CURRENT_DATE) + INTERVAL '1 month'
  END
WHERE package_name IS NULL;

-- 3. Set default values for new columns
ALTER TABLE public.members ALTER COLUMN package_name SET DEFAULT 'Monthly';
ALTER TABLE public.members ALTER COLUMN package_duration SET DEFAULT '1 Month';
ALTER TABLE public.members ALTER COLUMN package_price SET DEFAULT 1500;
ALTER TABLE public.members ALTER COLUMN package_start_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.members ALTER COLUMN package_end_date SET DEFAULT (CURRENT_DATE + INTERVAL '1 month');

-- 4. Mark membership_plan and join_date as nullable for backwards compatibility
ALTER TABLE public.members ALTER COLUMN membership_plan DROP NOT NULL;
ALTER TABLE public.members ALTER COLUMN join_date DROP NOT NULL;
