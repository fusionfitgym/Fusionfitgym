"use server";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { revalidatePath } from 'next/cache';

export interface SearchMemberResult {
  id: string;
  full_name: string;
  phone: string;
  biometric_user_id: string | null;
  status: string;
  biometric_status: 'ENABLED' | 'DISABLED' | null;
  package_end_date: string | null;
}

export interface BiometricQueueItem {
  id: string;
  member_id: string;
  biometric_id: string;
  action: 'enable' | 'disable';
  status: 'pending' | 'sent' | 'completed' | 'failed';
  notes: string | null;
  created_at: string;
  updated_at: string;
  member_name?: string;
}

export interface SyncAgentStatus {
  lastPollTime: string | null;
  lastCompletedAction: string | null;
  lastError: string | null;
  queueSize: number;
}

// 1. Search Members
export async function searchMembersForTesting(searchQuery: string): Promise<SearchMemberResult[]> {
  await validateRole(['Super Admin']);
  const supabase = await createClient();

  if (!searchQuery || searchQuery.trim() === '') {
    return [];
  }

  const queryClean = searchQuery.trim();
  let query = supabase
    .from('members')
    .select('id, full_name, phone, biometric_user_id, status, biometric_status, package_end_date');

  // Check if search query is a valid UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(queryClean);
  if (isUuid) {
    query = query.eq('id', queryClean);
  } else {
    // Search by Name, Biometric ID (biometric_user_id), or phone
    query = query.or(`full_name.ilike.%${queryClean}%,phone.ilike.%${queryClean}%,biometric_user_id.ilike.%${queryClean}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) {
    console.error('Error searching members for testing:', error);
    throw new Error('Search failed: ' + error.message);
  }

  return (data || []) as SearchMemberResult[];
}

// 2. Helper to insert action and cancel superseding actions
async function enqueueBiometricActionInternal(
  supabase: any,
  memberId: string,
  biometricId: string,
  action: 'enable' | 'disable',
  isTestMode: boolean
) {
  // Check for existing pending action
  const { data: existingActions } = await supabase
    .from('biometric_actions')
    .select('id, action')
    .eq('member_id', memberId)
    .eq('status', 'pending');

  const hasSameAction = existingActions?.some((a: any) => a.action === action);
  if (hasSameAction) {
    return; // Already has identical action queued
  }

  // Supersede other pending actions
  const differentActions = existingActions?.filter((a: any) => a.action !== action);
  if (differentActions && differentActions.length > 0) {
    const idsToUpdate = differentActions.map((a: any) => a.id);
    await supabase
      .from('biometric_actions')
      .update({
        status: 'completed',
        notes: 'Superseded by new test action',
        updated_at: new Date().toISOString()
      })
      .in('id', idsToUpdate);
  }

  // Insert new pending action
  const { error: insertError } = await supabase
    .from('biometric_actions')
    .insert({
      member_id: memberId,
      biometric_id: biometricId,
      action: action,
      status: 'pending',
      notes: isTestMode ? 'TEST MODE' : null
    });

  if (insertError) {
    throw insertError;
  }
}

// 3. Disable Biometric (Test Mode)
export async function disableBiometricTest(memberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    // Fetch member biometric_user_id
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('full_name, biometric_user_id')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found' };
    }

    if (!member.biometric_user_id) {
      return { success: false, error: 'Member does not have a Biometric ID mapped.' };
    }

    // Set biometric_status = DISABLED in members table
    const { error: updateErr } = await supabase
      .from('members')
      .update({ biometric_status: 'DISABLED' })
      .eq('id', memberId);

    if (updateErr) throw updateErr;

    // Queue disable action with notes = 'TEST MODE'
    await enqueueBiometricActionInternal(supabase, memberId, member.biometric_user_id, 'disable', true);

    await logAudit(`Biometric Disabled (Test) for member: ${member.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in disableBiometricTest:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 4. Enable Biometric (Test Mode)
export async function enableBiometricTest(memberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    // Fetch member biometric_user_id
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('full_name, biometric_user_id')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found' };
    }

    if (!member.biometric_user_id) {
      return { success: false, error: 'Member does not have a Biometric ID mapped.' };
    }

    // Set biometric_status = ENABLED in members table
    const { error: updateErr } = await supabase
      .from('members')
      .update({ biometric_status: 'ENABLED' })
      .eq('id', memberId);

    if (updateErr) throw updateErr;

    // Queue enable action
    await enqueueBiometricActionInternal(supabase, memberId, member.biometric_user_id, 'enable', true);

    await logAudit(`Biometric Enabled (Test) for member: ${member.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in enableBiometricTest:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 5. Queue Disable Action
export async function queueDisableAction(memberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('full_name, biometric_user_id')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found' };
    }

    if (!member.biometric_user_id) {
      return { success: false, error: 'Member does not have a Biometric ID mapped.' };
    }

    // Queue action only, do NOT modify biometric_status
    await enqueueBiometricActionInternal(supabase, memberId, member.biometric_user_id, 'disable', false);

    await logAudit(`Queued Biometric Disable Action for member: ${member.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueDisableAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 6. Queue Enable Action
export async function queueEnableAction(memberId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('full_name, biometric_user_id')
      .eq('id', memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found' };
    }

    if (!member.biometric_user_id) {
      return { success: false, error: 'Member does not have a Biometric ID mapped.' };
    }

    // Queue action only, do NOT modify biometric_status
    await enqueueBiometricActionInternal(supabase, memberId, member.biometric_user_id, 'enable', false);

    await logAudit(`Queued Biometric Enable Action for member: ${member.full_name}`, 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in queueEnableAction:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 7. Clear Pending Actions
export async function clearPendingActions(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin']);
    const supabase = await createClient();

    const { error } = await supabase
      .from('biometric_actions')
      .delete()
      .in('status', ['pending', 'sent']);

    if (error) throw error;

    await logAudit('Cleared pending biometric actions queue', 'Biometrics', user.id);
    revalidatePath('/settings/developer-tools/biometric-testing');

    return { success: true };
  } catch (err: any) {
    console.error('Error in clearPendingActions:', err);
    return { success: false, error: err.message || 'Action failed' };
  }
}

// 8. View Pending Queue
export async function getPendingQueue(): Promise<BiometricQueueItem[]> {
  await validateRole(['Super Admin']);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('biometric_actions')
    .select('id, member_id, biometric_id, action, status, notes, created_at, updated_at, members(full_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending queue:', error);
    throw new Error('Failed to fetch biometric actions queue');
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    biometric_id: row.biometric_id,
    action: row.action,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    member_name: row.members?.full_name || 'Unknown Member'
  }));
}

// 9. Sync Agent Status
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
    .select('action, updated_at, members(full_name)')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastCompletedAction = null;
  if (lastCompleted) {
    const memberName = lastCompleted.members?.full_name || 'Unknown';
    const actionFormatted = lastCompleted.action === 'enable' ? 'Enabled' : 'Disabled';
    const completedAt = new Date(lastCompleted.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    lastCompletedAction = `${actionFormatted} ${memberName} at ${completedAt}`;
  }

  // C. Last Error
  const { data: lastErrAction } = await supabase
    .from('biometric_actions')
    .select('action, notes, updated_at, members(full_name)')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let lastError = null;
  if (lastErrAction) {
    const memberName = lastErrAction.members?.full_name || 'Unknown';
    const errorNotes = lastErrAction.notes || 'Sync agent communication error';
    lastError = `Failed to ${lastErrAction.action} ${memberName}: ${errorNotes}`;
  }

  // D. Queue Size
  const { count, error: countErr } = await supabase
    .from('biometric_actions')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'sent']);
  const queueSize = countErr ? 0 : (count || 0);

  return {
    lastPollTime,
    lastCompletedAction,
    lastError,
    queueSize
  };
}
