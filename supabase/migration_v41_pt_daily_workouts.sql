-- ============================================================
-- FusionFit Gym Management System — Migration v41
-- Create pt_daily_workouts table for PT workout logging
-- ============================================================

-- ── 1. Table: pt_daily_workouts ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_daily_workouts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  trainer_id      UUID REFERENCES public.pt_trainers(id) ON DELETE SET NULL,
  workout_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  title           TEXT NOT NULL,
  muscle_group    TEXT DEFAULT 'Full Body',
  exercises       TEXT,
  duration        INTEGER, -- in minutes
  calories_burned INTEGER,
  intensity       TEXT NOT NULL DEFAULT 'Moderate' CHECK (intensity IN ('Low', 'Moderate', 'High', 'Extreme')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pt_daily_workouts_client_id ON public.pt_daily_workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_pt_daily_workouts_workout_date ON public.pt_daily_workouts(workout_date);

-- ── 3. Trigger for updated_at ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pt_daily_workouts_updated_at'
  ) THEN
    CREATE TRIGGER pt_daily_workouts_updated_at 
      BEFORE UPDATE ON public.pt_daily_workouts 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ── 4. Enable Row Level Security ────────────────────────────
ALTER TABLE public.pt_daily_workouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow view daily workouts" ON public.pt_daily_workouts;
DROP POLICY IF EXISTS "Allow write daily workouts" ON public.pt_daily_workouts;

-- ── 5. RLS Policies ─────────────────────────────────────────
CREATE POLICY "Allow view daily workouts" ON public.pt_daily_workouts FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND (
       trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()) OR
       client_id IN (SELECT id FROM public.pt_clients WHERE trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()))
     )))
  );

CREATE POLICY "Allow write daily workouts" ON public.pt_daily_workouts FOR ALL TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND (
       trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()) OR
       client_id IN (SELECT id FROM public.pt_clients WHERE trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()))
     )))
  );
