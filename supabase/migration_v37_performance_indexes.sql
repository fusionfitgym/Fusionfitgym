-- ============================================================
-- FusionFit Gym Management System — Migration V37
-- Full-Stack Database Performance Indexes & Foreign Key Optimization
-- ============================================================

-- ── Members Table Indexes ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_phone ON public.members(phone);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_package_name ON public.members(package_name);
CREATE INDEX IF NOT EXISTS idx_members_package_end_date ON public.members(package_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_members_biometric_user_id ON public.members(biometric_user_id);
CREATE INDEX IF NOT EXISTS idx_members_status_end_date ON public.members(status, package_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_members_machine_type ON public.members(machine_type);

-- ── Invoices Table Indexes ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_member_created ON public.invoices(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status_created ON public.invoices(status, created_at DESC);

-- ── Attendance Logs Indexes ───────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_member_time ON public.attendance_logs(member_id, punch_time DESC);
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_bio_time ON public.attendance_logs(biometric_user_id, punch_time DESC);
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_sync ON public.attendance_logs(sync_status);
  END IF;
END $do$;

-- ── SMS Logs Indexes ──────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sms_logs_member_created ON public.sms_logs(member_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON public.sms_logs(status);
  END IF;
END $do$;

-- ── Membership Renewals Indexes ────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership_renewals'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_membership_renewals_member_date ON public.membership_renewals(member_id, renewal_date DESC);
    CREATE INDEX IF NOT EXISTS idx_membership_renewals_date ON public.membership_renewals(renewal_date DESC);
  END IF;
END $do$;

-- ── Personal Training Indexes ─────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pt_clients'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pt_clients_member_id ON public.pt_clients(member_id);
    CREATE INDEX IF NOT EXISTS idx_pt_clients_trainer_id ON public.pt_clients(trainer_id);
    CREATE INDEX IF NOT EXISTS idx_pt_clients_status ON public.pt_clients(status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pt_sessions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pt_sessions_client_date ON public.pt_sessions(client_id, session_date DESC);
    CREATE INDEX IF NOT EXISTS idx_pt_sessions_trainer_date ON public.pt_sessions(trainer_id, session_date DESC);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pt_invoices'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pt_invoices_client_id ON public.pt_invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_pt_invoices_status ON public.pt_invoices(status);
  END IF;
END $do$;

-- ── Staff Table Indexes ───────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff(role);
    CREATE INDEX IF NOT EXISTS idx_staff_status ON public.staff(status);
    CREATE INDEX IF NOT EXISTS idx_staff_gents_bio ON public.staff(biometric_gents_id);
    CREATE INDEX IF NOT EXISTS idx_staff_ladies_bio ON public.staff(biometric_ladies_id);
  END IF;
END $do$;
