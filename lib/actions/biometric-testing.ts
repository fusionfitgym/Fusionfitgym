"use server";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { revalidatePath } from 'next/cache';
import { table } from 'console';

export interface SearchMemberResult {
  id: string;
  full_name: string;
  phone: string;
  biometric_user_id: string | null;
  status: string;
  biometric_status: 'ENABLED' | 'DISABLED' | 'BLOCKED' | 'DELETED' | 'PENDING' | null;
  package_end_date: string | null;
  entity_type: 'member' | 'staff';
}

export interface BiometricQueueItem {
  id: string;
  member_id: string | null;
  staff_id: string | null;
  biometric_id: string;
  action: 'enable' | 'disable' | 'verify' | 'read';
  disable_method: 'block' | 'delete';
  status: 'pending' | 'sent' | 'executing' | 'verifying' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
  entity_name?: string;
  entity_type: 'member' | 'staff';
}

export interface SyncAgentStatus {
  lastPollTime: string | null;
  lastCompletedAction: string | null;
  lastError: string | null;
  queueSize: number;
}

// 1. Unified Search: Members and Staff
export async function searchMembersForTesting(searchQuery: string): Promise<SearchMemberResult[]> {
  await validateRole(['Super Admin']);
  const supabase = await createClient();

  if (!searchQuery || searchQuery.trim() === '') {
    return [];
  }

  const queryClean = searchQuery.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryClean);

  const results: SearchMemberResult[] = [];

  // A. Search Members
  let mQuery = supabase
    .from('members')
    .select('id, full_name, phone, biometric_user_id, status, biometric_status, package_end_date');

  if (isUuid) {
    mQuery = mQuery.eq('id', queryClean);
  } else {
    mQuery = mQuery.or(`full_name.ilike.%${queryClean}%,phone.ilike.%${queryClean}%,biometric_user_id.ilike.%${queryClean}%`);
  }

  const { data: members, error: mErr } = await mQuery.limit(25);
  if (!mErr && members) {
    members.forEach((m: any) => {
      results.push({
        id: m.id,
        full_name: m.full_name,
        phone: m.phone,
        biometric_user_id: m.biometric_user_id || null,
        status: m.status,
        biometric_status: m.biometric_status as any,
        package_end_date: m.package_end_date || null,
        entity_type: 'member'
      });
    });
  }

  // B. Search Staff
  let sQuery = supabase
    .from('staff')
    .select('id, full_name, phone, biometric_gents_id, biometric_ladies_id, status, biometric_status, joining_date');

  if (isUuid) {
    sQuery = sQuery.eq('id', queryClean);
  } else {
    sQuery = sQuery.or(`full_name.ilike.%${queryClean}%,phone.ilike.%${queryClean}%,biometric_gents_id.ilike.%${queryClean}%,biometric_ladies_id.ilike.%${queryClean}%`);
  }

  const { data: staff, error: sErr } = await sQuery.limit(25);
  if (!sErr && staff) {
    staff.forEach((s: any) => {
      results.push({
        id: s.id,
        full_name: s.full_name,
        phone: s.phone,
        biometric_user_id: s.biometric_gents_id || s.biometric_ladies_id || null,
        status: s.status,
        biometric_status: s.biometric_status as any,
        package_end_date: s.joining_date || null,
        entity_type: 'staff'
      });
    });
  }

  return results;
}

// 2. Queueing Core Helper
async function enqueueBiometricActionInternal(
  supabase: any,
  entityId: string,
  entityType: 'member' | 'staff',
  biometricId: string,
  action: 'enable' | 'disable' | 'verify' | 'read',
  disableMethod: 'block' | 'delete' = 'block',
  operatorName: string,
  priority = 0
) {
  // Check for existing pending action
  const { data: existingActions } = await supabase
    .from('biometric_actions')
    .select('id, action, disable_method')
    .eq(entityType === 'member' ? 'member_id' : 'staff_id', entityId)
    .eq('status', 'pending');

  const hasSameAction = existingActions?.some((a: any) => a.action === action && (action !== 'disable' || a.disable_method === disableMethod));
  if (hasSameAction) {
    return; // Duplicate
  }

  // Supersede other pending actions
  if (existingActions && existingActions.length > 0) {
    const idsToUpdate = existingActions.map((a: any) => a.id);
    await supabase
      .from('biometric_actions')
      .update({
        status: 'completed',
        notes: 'Superseded by new manual test command',
        updated_at: new Date().toISOString()
      })
      .in('id', idsToUpdate);
  }

  // Insert new pending action
  const insertPayload: any = {
    biometric_id: biometricId,
    action: action,
    disable_method: disableMethod,
    entity_type: entityType,
    status: 'pending',
    priority: priority,
    notes: `Queued manually by ${operatorName}`
  };

  if (entityType === 'member') {
    insertPayload.member_id = entityId;
  } else {
    insertPayload.staff_id = entityId;
  }

  const { error: insertError } = await supabase
    .from('biometric_actions')
    .insert(insertPayload);

  if (insertError) {
    throw insertError;
  }
}

// 3. Queue Block Action (disable with block method)
export async function queueBlockAction(entityId: string, entityType: 'member' | 'staff'): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const selectCols = entityType === 'member' ? 'full_name, biometric_user_id' : 'full_name, biometric_gents_id, biometric_ladies_id';
    const { data: entity, error: fetchErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq('id', entityId)
      .single();

    if (fetchErr || !entity) return { success: false, error: 'User not found' };

    const bioId = entity.biometric_user_id || entity.biometric_gents_id || entity.biometric_ladies_id;
    if (!bioId) return { success: false, error: 'User does not have a Biometric ID mapped.' };

    // Update state to PENDING in profiles
    await supabase.from(table).update({ biometric_status: 'PENDING' }).eq('id', entityId);

    // Queue Block Action (priority = 10 for block)
    await enqueueBiometricActionInternal(supabase, entityId, entityType, bioId, 'disable', 'block', user.email || 'Admin', 10);

    await logAudit(`Queued Biometric Block Action for ${entityType}: ${entity.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueBlockAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 4. Queue Unblock Action (enable)
export async function queueUnblockAction(entityId: string, entityType: 'member' | 'staff'): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const selectCols = entityType === 'member' ? 'full_name, biometric_user_id' : 'full_name, biometric_gents_id, biometric_ladies_id';
    const { data: entity, error: fetchErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq('id', entityId)
      .single();

    if (fetchErr || !entity) return { success: false, error: 'User not found' };

    const bioId = entity.biometric_user_id || entity.biometric_gents_id || entity.biometric_ladies_id;
    if (!bioId) return { success: false, error: 'User does not have a Biometric ID mapped.' };

    // Update state to PENDING in profiles
    await supabase.from(table).update({ biometric_status: 'PENDING' }).eq('id', entityId);

    // Queue Unblock Action (priority = 10)
    await enqueueBiometricActionInternal(supabase, entityId, entityType, bioId, 'enable', 'block', user.email || 'Admin', 10);

    await logAudit(`Queued Biometric Unblock Action for ${entityType}: ${entity.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueUnblockAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 5. Queue Delete Action (disable with delete method)
export async function queueDeleteAction(entityId: string, entityType: 'member' | 'staff'): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const selectCols = entityType === 'member' ? 'full_name, biometric_user_id' : 'full_name, biometric_gents_id, biometric_ladies_id';
    const { data: entity, error: fetchErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq('id', entityId)
      .single();

    if (fetchErr || !entity) return { success: false, error: 'User not found' };

    const bioId = entity.biometric_user_id || entity.biometric_gents_id || entity.biometric_ladies_id;
    if (!bioId) return { success: false, error: 'User does not have a Biometric ID mapped.' };

    // Update state to PENDING in profiles
    await supabase.from(table).update({ biometric_status: 'PENDING' }).eq('id', entityId);

    // Queue Delete Action (priority = 10)
    await enqueueBiometricActionInternal(supabase, entityId, entityType, bioId, 'disable', 'delete', user.email || 'Admin', 10);

    await logAudit(`Queued Biometric Delete Action for ${entityType}: ${entity.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueDeleteAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 6. Queue Verify Action (verify)
export async function queueVerifyUserAction(entityId: string, entityType: 'member' | 'staff'): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const selectCols = entityType === 'member' ? 'full_name, biometric_user_id' : 'full_name, biometric_gents_id, biometric_ladies_id';
    const { data: entity, error: fetchErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq('id', entityId)
      .single();

    if (fetchErr || !entity) return { success: false, error: 'User not found' };

    const bioId = entity.biometric_user_id || entity.biometric_gents_id || entity.biometric_ladies_id;
    if (!bioId) return { success: false, error: 'User does not have a Biometric ID mapped.' };

    // Queue Verify Action (priority = 5)
    await enqueueBiometricActionInternal(supabase, entityId, entityType, bioId, 'verify', 'block', user.email || 'Admin', 5);

    await logAudit(`Queued Biometric Verify Action for ${entityType}: ${entity.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueVerifyUserAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 7. Queue Read Action (read)
export async function queueReadUserAction(entityId: string, entityType: 'member' | 'staff'): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const selectCols = entityType === 'member' ? 'full_name, biometric_user_id' : 'full_name, biometric_gents_id, biometric_ladies_id';
    const { data: entity, error: fetchErr } = await supabase
      .from(table)
      .select(selectCols)
      .eq('id', entityId)
      .single();

    if (fetchErr || !entity) return { success: false, error: 'User not found' };

    const bioId = entity.biometric_user_id || entity.biometric_gents_id || entity.biometric_ladies_id;
    if (!bioId) return { success: false, error: 'User does not have a Biometric ID mapped.' };

    // Queue Read Action (priority = 5)
    await enqueueBiometricActionInternal(supabase, entityId, entityType, bioId, 'read', 'block', user.email || 'Admin', 5);

    await logAudit(`Queued Biometric Read Action for ${entityType}: ${entity.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueReadUserAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 8. Clear Queue
export async function clearPendingActions(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const { error } = await supabase
      .from('biometric_actions')
      .delete()
      .in('status', ['pending', 'sent', 'executing', 'verifying']);

    if (error) throw error;

    await logAudit('Cleared pending biometric actions queue', 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in clearPendingActions:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 9. View Pending Queue
export async function getPendingQueue(): Promise<BiometricQueueItem[]> {
  await validateRole(['Super Admin']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('biometric_actions')
    .select('*, members(full_name), staff(full_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending queue:', error);
    throw new Error('Failed to fetch biometric actions queue');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    staff_id: row.staff_id,
    biometric_id: row.biometric_id,
    action: row.action,
    disable_method: row.disable_method,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    entity_name: row.members?.full_name || row.staff?.full_name || 'Unknown',
    entity_type: row.staff_id ? 'staff' : 'member' as 'member' | 'staff'
  }));
}

// 10. Sync Agent Status
export async function getSyncAgentStatus(): Promise<SyncAgentStatus> {
  await validateRole(['Super Admin']);
  const supabase = await createClient();

  // A. Last Poll Time (read settings table)
  const { data: pollSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'biometric_last_poll_time')
    .maybeSingle();
  const lastPollTime = pollSetting?.value || null;

  // B. Last Completed Action
  const { data: lastCompleted } = await supabase
    .from('biometric_actions')
    .select('action, updated_at, members(full_name), staff(full_name)')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastCompletedAction = null;
  if (lastCompleted) {
    const entityName = lastCompleted.members?.full_name || lastCompleted.staff?.full_name || 'Unknown';
    const actionFormatted = lastCompleted.action === 'enable' ? 'Enabled' : 'Disabled';
    const completedAt = new Date(lastCompleted.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    lastCompletedAction = `${actionFormatted} ${entityName} at ${completedAt}`;
  }

  // C. Last Error
  const { data: lastErrAction } = await supabase
    .from('biometric_actions')
    .select('action, error_message, updated_at, members(full_name), staff(full_name)')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastError = null;
  if (lastErrAction) {
    const entityName = lastErrAction.members?.full_name || lastErrAction.staff?.full_name || 'Unknown';
    const errorMsg = lastErrAction.error_message || 'Sync agent verification failed';
    lastError = `Failed to ${lastErrAction.action} ${entityName}: ${errorMsg}`;
  }

  // D. Queue Size
  const { count, error: countErr } = await supabase
    .from('biometric_actions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'sent', 'executing', 'verifying']);
  const queueSize = countErr ? 0 : (count || 0);

  return {
    lastPollTime,
    lastCompletedAction,
    lastError,
    queueSize
  };
}
