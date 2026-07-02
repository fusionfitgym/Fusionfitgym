-- ============================================================
-- FusionFit Gym Management System — Migration v26
-- Create Personal Training (PT) Module tables and triggers
-- ============================================================

-- ── 1. Sequences ─────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.pt_invoice_seq START 1001;

-- ── 2. Table: pt_trainers ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_trainers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  specialization    TEXT,
  availability      TEXT, -- e.g., 'Monday - Saturday'
  working_hours     TEXT, -- e.g., '06:00 - 12:00, 16:00 - 20:00'
  commission_type   TEXT CHECK (commission_type IN ('Percentage', 'Fixed', 'Per Session', 'Per Package')) DEFAULT 'Percentage',
  commission_value  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- ── 3. Table: pt_packages ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_packages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_name        TEXT NOT NULL,
  description         TEXT,
  trainer_id          UUID REFERENCES public.pt_trainers(id) ON DELETE SET NULL,
  number_of_sessions  INTEGER NOT NULL CHECK (number_of_sessions > 0),
  duration            INTEGER NOT NULL CHECK (duration > 0), -- in days
  price               NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  discount            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  final_price         NUMERIC(10,2) NOT NULL CHECK (final_price >= 0),
  status              TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- ── 4. Table: pt_clients ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_clients (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id           UUID REFERENCES public.members(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  phone               TEXT NOT NULL,
  email               TEXT,
  emergency_contact   TEXT,
  trainer_id          UUID REFERENCES public.pt_trainers(id) ON DELETE SET NULL,
  package_id          UUID REFERENCES public.pt_packages(id) ON DELETE SET NULL,
  sessions_purchased  INTEGER NOT NULL DEFAULT 0,
  sessions_remaining  INTEGER NOT NULL DEFAULT 0,
  package_start_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date         DATE NOT NULL,
  height              NUMERIC(5,2), -- cm
  weight              NUMERIC(5,2), -- kg
  body_fat            NUMERIC(4,2), -- %
  goal                TEXT,
  medical_notes       TEXT,
  status              TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Expired')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);

-- ── 5. Table: pt_sessions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  trainer_id      UUID NOT NULL REFERENCES public.pt_trainers(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  session_time    TIME NOT NULL,
  duration        INTEGER NOT NULL DEFAULT 60, -- minutes
  workout_plan    TEXT,
  status          TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Completed', 'Missed', 'Cancelled', 'Rescheduled')),
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. Table: pt_session_attendance ──────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_session_attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES public.pt_sessions(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  trainer_id      UUID NOT NULL REFERENCES public.pt_trainers(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Cancelled', 'Late')),
  marked_by       UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. Table: pt_progress ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_progress (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  weight        NUMERIC(5,2),
  height        NUMERIC(5,2),
  bmi           NUMERIC(4,2),
  body_fat      NUMERIC(4,2),
  chest         NUMERIC(5,2),
  waist         NUMERIC(5,2),
  arms          NUMERIC(5,2),
  legs          NUMERIC(5,2),
  photo_before  TEXT,
  photo_after   TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Table: pt_invoices ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_invoices (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id                     UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  invoice_number                TEXT NOT NULL UNIQUE,
  invoice_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  trainer_id                    UUID REFERENCES public.pt_trainers(id) ON DELETE SET NULL,
  package_id                    UUID REFERENCES public.pt_packages(id) ON DELETE SET NULL,
  package_name                  TEXT NOT NULL,
  sessions_included             INTEGER NOT NULL,
  sessions_remaining_at_invoice INTEGER NOT NULL,
  price                         NUMERIC(10,2) NOT NULL,
  discount                      NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount                    NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount                    NUMERIC(10,2) NOT NULL DEFAULT 0,
  final_amount                  NUMERIC(10,2) NOT NULL,
  payment_method                TEXT,
  paid_amount                   NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due                   NUMERIC(10,2) NOT NULL,
  due_date                      DATE NOT NULL,
  next_due_date                 DATE,
  status                        TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  terms_conditions              TEXT,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. Table: pt_payments ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES public.pt_invoices(id) ON DELETE SET NULL,
  amount_paid     NUMERIC(10,2) NOT NULL,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Card', 'Bank Transfer', 'Split Payment', 'Partial Payment')),
  split_details   JSONB, -- { "Cash": 1000, "UPI": 500 }
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. Table: pt_commissions ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_commissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trainer_id      UUID NOT NULL REFERENCES public.pt_trainers(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.pt_clients(id) ON DELETE SET NULL,
  session_id      UUID REFERENCES public.pt_sessions(id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES public.pt_invoices(id) ON DELETE SET NULL,
  amount          NUMERIC(10,2) NOT NULL,
  commission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid')),
  paid_date       DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. Table: pt_notifications ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.pt_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID REFERENCES public.pt_clients(id) ON DELETE CASCADE,
  trainer_id  UUID REFERENCES public.pt_trainers(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('Upcoming Session', 'Missed Session', 'Package Expiry', 'Low Remaining Sessions', 'Pending Payment', 'Trainer Schedule Reminder')),
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 12. Automated Triggers ───────────────────────────────────

-- update_updated_at trigger assignments
CREATE TRIGGER pt_trainers_updated_at BEFORE UPDATE ON public.pt_trainers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_packages_updated_at BEFORE UPDATE ON public.pt_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_clients_updated_at BEFORE UPDATE ON public.pt_clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_sessions_updated_at BEFORE UPDATE ON public.pt_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_session_attendance_updated_at BEFORE UPDATE ON public.pt_session_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_progress_updated_at BEFORE UPDATE ON public.pt_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_invoices_updated_at BEFORE UPDATE ON public.pt_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_payments_updated_at BEFORE UPDATE ON public.pt_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pt_commissions_updated_at BEFORE UPDATE ON public.pt_commissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger for generating invoice number
CREATE OR REPLACE FUNCTION generate_pt_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'PT-INV-' || LPAD(nextval('public.pt_invoice_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_invoice_number_trigger
  BEFORE INSERT ON public.pt_invoices
  FOR EACH ROW EXECUTE FUNCTION generate_pt_invoice_number();

-- Trigger for remaining sessions decrement/increment
CREATE OR REPLACE FUNCTION public.handle_pt_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Completed' THEN
      UPDATE public.pt_clients
      SET sessions_remaining = GREATEST(0, sessions_remaining - 1)
      WHERE id = NEW.client_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'Completed' AND NEW.status = 'Completed' THEN
      UPDATE public.pt_clients
      SET sessions_remaining = GREATEST(0, sessions_remaining - 1)
      WHERE id = NEW.client_id;
    ELSIF OLD.status = 'Completed' AND NEW.status != 'Completed' THEN
      UPDATE public.pt_clients
      SET sessions_remaining = sessions_remaining + 1
      WHERE id = NEW.client_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'Completed' THEN
      UPDATE public.pt_clients
      SET sessions_remaining = sessions_remaining + 1
      WHERE id = OLD.client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_session_status_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pt_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_pt_session_status_change();

-- Trigger for session-based commission
CREATE OR REPLACE FUNCTION public.handle_pt_session_commission()
RETURNS TRIGGER AS $$
DECLARE
  t_comm_type TEXT;
  t_comm_val NUMERIC(10,2);
BEGIN
  SELECT commission_type, commission_value INTO t_comm_type, t_comm_val
  FROM public.pt_trainers
  WHERE id = NEW.trainer_id;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'Completed' AND (TG_OP = 'INSERT' OR OLD.status != 'Completed') THEN
      IF t_comm_type = 'Per Session' THEN
        INSERT INTO public.pt_commissions (trainer_id, client_id, session_id, amount, status, commission_date)
        VALUES (NEW.trainer_id, NEW.client_id, NEW.id, t_comm_val, 'Pending', NEW.session_date);
      END IF;
    ELSIF NEW.status != 'Completed' AND TG_OP = 'UPDATE' AND OLD.status = 'Completed' THEN
      IF t_comm_type = 'Per Session' THEN
        DELETE FROM public.pt_commissions
        WHERE session_id = NEW.id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.pt_commissions WHERE session_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_session_commission_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pt_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_pt_session_commission();

-- Trigger for invoice-based commission (Percentage / Fixed / Per Package)
CREATE OR REPLACE FUNCTION public.handle_pt_invoice_commission()
RETURNS TRIGGER AS $$
DECLARE
  t_comm_type TEXT;
  t_comm_val NUMERIC(10,2);
  c_amount NUMERIC(10,2);
BEGIN
  SELECT commission_type, commission_value INTO t_comm_type, t_comm_val
  FROM public.pt_trainers
  WHERE id = NEW.trainer_id;

  IF NEW.status = 'Paid' AND (OLD.status IS NULL OR OLD.status != 'Paid') THEN
    IF t_comm_type = 'Fixed' THEN
      c_amount := t_comm_val;
    ELSIF t_comm_type = 'Percentage' THEN
      c_amount := (NEW.final_amount * t_comm_val) / 100.0;
    ELSIF t_comm_type = 'Per Package' THEN
      c_amount := t_comm_val;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.pt_commissions (trainer_id, client_id, invoice_id, amount, status, commission_date)
    VALUES (NEW.trainer_id, NEW.client_id, NEW.id, c_amount, 'Pending', CURRENT_DATE);
  ELSIF NEW.status != 'Paid' AND OLD.status = 'Paid' THEN
    DELETE FROM public.pt_commissions
    WHERE invoice_id = NEW.id AND status = 'Pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pt_invoice_commission_trigger
  AFTER INSERT OR UPDATE ON public.pt_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_pt_invoice_commission();

-- ── 13. Enable Row Level Security ───────────────────────────
ALTER TABLE public.pt_trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_session_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pt_notifications ENABLE ROW LEVEL SECURITY;

-- ── 14. Row Level Security Policies ──────────────────────────

-- General select access for authenticated non-disabled users
CREATE POLICY "Allow select on trainers" ON public.pt_trainers FOR SELECT TO authenticated USING (NOT public.check_is_user_disabled());
CREATE POLICY "Allow select on packages" ON public.pt_packages FOR SELECT TO authenticated USING (NOT public.check_is_user_disabled());

-- Write access for trainers & packages: Admin/Super Admin only
CREATE POLICY "Admin write trainers" ON public.pt_trainers FOR ALL TO authenticated USING (public.get_current_user_role() IN ('Super Admin', 'Admin'));
CREATE POLICY "Admin write packages" ON public.pt_packages FOR ALL TO authenticated USING (public.get_current_user_role() IN ('Super Admin', 'Admin'));

-- PT Clients Policies
CREATE POLICY "Allow view clients" ON public.pt_clients FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

CREATE POLICY "Allow write clients" ON public.pt_clients FOR ALL TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist')
  );

-- Sessions Policies
CREATE POLICY "Allow view sessions" ON public.pt_sessions FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

CREATE POLICY "Allow write sessions" ON public.pt_sessions FOR ALL TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

-- Session Attendance Policies
CREATE POLICY "Allow view attendance" ON public.pt_session_attendance FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

CREATE POLICY "Allow write attendance" ON public.pt_session_attendance FOR ALL TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

-- Progress Policies
CREATE POLICY "Allow view progress" ON public.pt_progress FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND client_id IN (SELECT id FROM public.pt_clients WHERE trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()))))
  );

CREATE POLICY "Allow write progress" ON public.pt_progress FOR ALL TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND client_id IN (SELECT id FROM public.pt_clients WHERE trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid()))))
  );

-- Payments & Invoices (Blocked for Trainers)
CREATE POLICY "Allow view payments" ON public.pt_payments FOR SELECT TO authenticated 
  USING (NOT public.check_is_user_disabled() AND public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist'));

CREATE POLICY "Allow write payments" ON public.pt_payments FOR ALL TO authenticated 
  USING (NOT public.check_is_user_disabled() AND public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist'));

CREATE POLICY "Allow view invoices" ON public.pt_invoices FOR SELECT TO authenticated 
  USING (NOT public.check_is_user_disabled() AND public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist'));

CREATE POLICY "Allow write invoices" ON public.pt_invoices FOR ALL TO authenticated 
  USING (NOT public.check_is_user_disabled() AND public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist'));

-- Trainer Commissions
CREATE POLICY "Allow view commissions" ON public.pt_commissions FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

CREATE POLICY "Allow write commissions" ON public.pt_commissions FOR ALL TO authenticated 
  USING (NOT public.check_is_user_disabled() AND public.get_current_user_role() IN ('Super Admin', 'Admin'));

-- Notifications
CREATE POLICY "Allow view notifications" ON public.pt_notifications FOR SELECT TO authenticated 
  USING (
    NOT public.check_is_user_disabled() AND 
    (public.get_current_user_role() IN ('Super Admin', 'Admin', 'Receptionist') OR 
     (public.get_current_user_role() = 'Trainer' AND trainer_id IN (SELECT id FROM public.pt_trainers WHERE auth_user_id = auth.uid())))
  );

CREATE POLICY "Allow write notifications" ON public.pt_notifications FOR ALL TO authenticated 
  USING (NOT public.check_is_user_disabled());
