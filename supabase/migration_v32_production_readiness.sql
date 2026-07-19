-- ============================================================
-- FusionFit Gym Management System — Migration v32
-- Production Readiness, Database Triggers, and Constraints
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Update Biometric Actions Constraint ────────────────────
-- Ensure the action column supports all required test and sync commands
ALTER TABLE public.biometric_actions DROP CONSTRAINT IF EXISTS biometric_actions_action_check;
ALTER TABLE public.biometric_actions ADD CONSTRAINT biometric_actions_action_check 
  CHECK (action IN ('enable', 'disable', 'verify', 'read'));

-- ── 2. Add Composite Uniqueness Constraint for Members ────────
-- Prevent duplicate biometric IDs per machine (Gents/Ladies machines are separate)
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_biometric_machine_unique;
ALTER TABLE public.members ADD CONSTRAINT members_biometric_machine_unique 
  UNIQUE (biometric_user_id, machine_type);

-- ── 3. Modify Attendance Log Retention to 90 Days ─────────────
-- Increase logs retention policy from 15 days to 90 days to support monthly trends
CREATE OR REPLACE FUNCTION public.cleanup_old_attendance_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.attendance_logs
  WHERE punch_time < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ── 4. Member Biometric Synchronization Trigger ────────────────
-- Automatically queues a block/unblock or mapping command when status/ID changes

CREATE OR REPLACE FUNCTION public.before_member_update_biometric_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Expired' OR NEW.status = 'Inactive' THEN
    NEW.biometric_status := 'DISABLED';
  ELSIF NEW.status = 'Active' THEN
    NEW.biometric_status := 'ENABLED';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS member_biometric_status_before_trigger ON public.members;
CREATE TRIGGER member_biometric_status_before_trigger
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.before_member_update_biometric_status();

CREATE OR REPLACE FUNCTION public.after_member_update_queue_biometric()
RETURNS TRIGGER AS $$
DECLARE
  target_action TEXT;
BEGIN
  -- Scenario A: Biometric ID has changed (Old: 2 -> New: 1)
  IF (OLD.biometric_user_id IS DISTINCT FROM NEW.biometric_user_id) THEN
    -- Disable and delete the old mapping
    IF (OLD.biometric_user_id IS NOT NULL AND OLD.biometric_user_id <> '') THEN
      INSERT INTO public.biometric_actions (member_id, biometric_id, action, disable_method, status, notes)
      VALUES (OLD.id, OLD.biometric_user_id, 'disable', 'delete', 'pending', 'Auto-queued: Biometric ID changed, removing old mapping');
    END IF;

    -- Enable/disable the new mapping
    IF (NEW.biometric_user_id IS NOT NULL AND NEW.biometric_user_id <> '') THEN
      target_action := CASE WHEN NEW.status = 'Active' THEN 'enable' ELSE 'disable' END;
      INSERT INTO public.biometric_actions (member_id, biometric_id, action, status, notes)
      VALUES (NEW.id, NEW.biometric_user_id, target_action, 'pending', 'Auto-queued: Biometric ID changed, queueing new mapping');
    END IF;

  -- Scenario B: Biometric ID remains the same, but Membership Status has changed
  ELSIF (OLD.status IS DISTINCT FROM NEW.status AND NEW.biometric_user_id IS NOT NULL AND NEW.biometric_user_id <> '') THEN
    target_action := CASE WHEN NEW.status = 'Active' THEN 'enable' ELSE 'disable' END;
    
    -- Cancel existing conflicting pending actions
    UPDATE public.biometric_actions
    SET status = 'completed', notes = 'Superseded by status transition trigger'
    WHERE member_id = NEW.id AND status = 'pending';

    -- Queue the state sync action
    INSERT INTO public.biometric_actions (member_id, biometric_id, action, status, notes)
    VALUES (NEW.id, NEW.biometric_user_id, target_action, 'pending', 'Auto-queued: Status changed to ' || NEW.status);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_biometric_trigger ON public.members;
CREATE TRIGGER members_biometric_trigger
  AFTER UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.after_member_update_queue_biometric();

-- ── 5. Staff Biometric Synchronization Trigger ─────────────────
-- Automatically queues actions when staff biometric mapping or status updates

CREATE OR REPLACE FUNCTION public.handle_staff_biometric_changes()
RETURNS TRIGGER AS $$
DECLARE
  old_gents TEXT;
  new_gents TEXT;
  old_ladies TEXT;
  new_ladies TEXT;
  old_status TEXT;
  new_status TEXT;
BEGIN
  old_gents := OLD.biometric_gents_id;
  new_gents := NEW.biometric_gents_id;
  old_ladies := OLD.biometric_ladies_id;
  new_ladies := NEW.biometric_ladies_id;
  old_status := OLD.status;
  new_status := NEW.status;

  -- Gents Biometric ID changed
  IF (old_gents IS DISTINCT FROM new_gents) THEN
    IF (old_gents IS NOT NULL AND old_gents <> '') THEN
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, disable_method, entity_type, status, notes)
      VALUES (OLD.id, old_gents, 'disable', 'delete', 'staff', 'pending', 'Auto-queued: Staff Gents Biometric ID changed, removing old mapping');
    END IF;
    IF (new_gents IS NOT NULL AND new_gents <> '') THEN
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, entity_type, status, notes)
      VALUES (NEW.id, new_gents, CASE WHEN new_status = 'Active' THEN 'enable' ELSE 'disable' END, 'staff', 'pending', 'Auto-queued: Staff Gents Biometric ID changed, queueing new mapping');
    END IF;
  END IF;

  -- Ladies Biometric ID changed
  IF (old_ladies IS DISTINCT FROM new_ladies) THEN
    IF (old_ladies IS NOT NULL AND old_ladies <> '') THEN
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, disable_method, entity_type, status, notes)
      VALUES (OLD.id, old_ladies, 'disable', 'delete', 'staff', 'pending', 'Auto-queued: Staff Ladies Biometric ID changed, removing old mapping');
    END IF;
    IF (new_ladies IS NOT NULL AND new_ladies <> '') THEN
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, entity_type, status, notes)
      VALUES (NEW.id, new_ladies, CASE WHEN new_status = 'Active' THEN 'enable' ELSE 'disable' END, 'staff', 'pending', 'Auto-queued: Staff Ladies Biometric ID changed, queueing new mapping');
    END IF;
  END IF;

  -- Status changed
  IF (old_status IS DISTINCT FROM new_status) THEN
    -- Gents mapping update
    IF (new_gents IS NOT NULL AND new_gents <> '') THEN
      UPDATE public.biometric_actions SET status = 'completed', notes = 'Superseded by staff status change' 
      WHERE staff_id = NEW.id AND biometric_id = new_gents AND status = 'pending';
      
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, entity_type, status, notes)
      VALUES (NEW.id, new_gents, CASE WHEN new_status = 'Active' THEN 'enable' ELSE 'disable' END, 'staff', 'pending', 'Auto-queued: Staff status changed to ' || new_status);
    END IF;
    -- Ladies mapping update
    IF (new_ladies IS NOT NULL AND new_ladies <> '') THEN
      UPDATE public.biometric_actions SET status = 'completed', notes = 'Superseded by staff status change' 
      WHERE staff_id = NEW.id AND biometric_id = new_ladies AND status = 'pending';
      
      INSERT INTO public.biometric_actions (staff_id, biometric_id, action, entity_type, status, notes)
      VALUES (NEW.id, new_ladies, CASE WHEN new_status = 'Active' THEN 'enable' ELSE 'disable' END, 'staff', 'pending', 'Auto-queued: Staff status changed to ' || new_status);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_biometric_trigger ON public.staff;
CREATE TRIGGER staff_biometric_trigger
  AFTER UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.handle_staff_biometric_changes();
