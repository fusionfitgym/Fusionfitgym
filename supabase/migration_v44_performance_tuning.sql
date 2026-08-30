-- ============================================================
-- FusionFit Gym Management System — Migration V44
-- High-Performance Composite Indexes & Query Optimization
-- ============================================================

-- ── 1. Members Table Optimization Indexes ───────────────────
-- Accelerates dashboard KPI counts (Active, Daily Pass, Training Types, Expiry)
CREATE INDEX IF NOT EXISTS idx_members_status_duration ON public.members(status, duration);
CREATE INDEX IF NOT EXISTS idx_members_status_training ON public.members(status, training_type);
CREATE INDEX IF NOT EXISTS idx_members_biometric_status ON public.members(biometric_status);
CREATE INDEX IF NOT EXISTS idx_members_status_end_date_asc ON public.members(status, package_end_date ASC);
CREATE INDEX IF NOT EXISTS idx_members_status_created ON public.members(status, created_at DESC);

-- ── 2. Invoices Table Optimization Indexes ──────────────────
-- Accelerates 4th-to-3rd monthly cycle revenue & 6-month revenue trends
CREATE INDEX IF NOT EXISTS idx_invoices_status_paid_date ON public.invoices(status, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status_created_at ON public.invoices(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_member_status ON public.invoices(member_id, status);

-- ── 3. Attendance Logs Indexes ──────────────────────────────
-- Accelerates today's punches, live occupancy & timeframe reports
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_punch_time ON public.attendance_logs(punch_time DESC);
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_punch_time_machine ON public.attendance_logs(punch_time DESC, machine_type);
    CREATE INDEX IF NOT EXISTS idx_attendance_logs_member_punch ON public.attendance_logs(member_id, punch_time DESC);
  END IF;
END $do$;

-- ── 4. SMS Logs Indexes ─────────────────────────────────────
-- Accelerates real-time SMS hub counts and dashboard notification metrics
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_logs'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_sms_logs_status_created_at ON public.sms_logs(status, created_at DESC);
  END IF;
END $do$;

-- ── 5. Staff Attendance Indexes ─────────────────────────────
-- Accelerates today's staff punch-in status and attendance history
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_attendance'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON public.staff_attendance(date);
    CREATE INDEX IF NOT EXISTS idx_staff_attendance_staff_date ON public.staff_attendance(staff_id, date DESC);
  END IF;
END $do$;

-- ── 6. Membership Renewals Indexes ──────────────────────────
-- Accelerates renewal counts for today & current month
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership_renewals'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_membership_renewals_date ON public.membership_renewals(renewal_date DESC);
  END IF;
END $do$;
