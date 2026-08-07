-- Migration v5: Body Composition Metrics for Health Assessments
ALTER TABLE health_assessments
  ADD COLUMN IF NOT EXISTS subcutaneous_fat_whole_body NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS subcutaneous_fat_trunk      NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS subcutaneous_fat_arms       NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS subcutaneous_fat_legs       NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS resting_metabolism          NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS skeletal_muscle_whole_body  NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS skeletal_muscle_trunk       NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS skeletal_muscle_arms        NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS skeletal_muscle_legs       NUMERIC(4,2);
