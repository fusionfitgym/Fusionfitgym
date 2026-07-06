"use server";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { validateRole } from './auth';
import { logAudit } from './audit';

export interface BiometricMetrics {
  pendingCount: number;
  executingCount: number;
  verifyingCount: number;
  completedCount: number;
  failedCount: number;
  avgExecutionTimeMs: number;
  lastSyncTime: string | null;
  connectedDevicesCount: number;
  lastDeviceResponse: string | null;
}

export interface InspectorCommandItem {
  id: string;
  member_id: string | null;
  staff_id: string | null;
  biometric_id: string;
  action: 'enable' | 'disable' | 'verify' | 'read';
  disable_method: 'block' | 'delete';
  status: 'pending' | 'sent' | 'executing' | 'verifying' | 'completed' | 'failed';
  notes: string | null;
  device_response: string | null;
  verification_result: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  entity_name?: string;
  entity_type: 'member' | 'staff';
}

// 1. Fetch metrics for Command Center
export async function getBiometricMetrics(): Promise<BiometricMetrics> {
  await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();

  // A. Fetch status counts from biometric_actions
  const { data: actions, error: actionsErr } = await supabase
    .from('biometric_actions')
    .select('status, execution_time_ms');

  if (actionsErr) {
    console.error('Error fetching biometric actions for metrics:', actionsErr);
    throw new Error('Failed to fetch biometric metrics');
  }

  let pendingCount = 0;
  let executingCount = 0;
  let verifyingCount = 0;
  let completedCount = 0;
  let failedCount = 0;
  let totalExecTime = 0;
  let execTimeCount = 0;

  (actions || []).forEach(a => {
    if (a.status === 'pending' || a.status === 'sent') pendingCount++;
    else if (a.status === 'executing') executingCount++;
    else if (a.status === 'verifying') verifyingCount++;
    else if (a.status === 'completed') completedCount++;
    else if (a.status === 'failed') failedCount++;

    if (a.execution_time_ms) {
      totalExecTime += a.execution_time_ms;
      execTimeCount++;
    }
  });

  const avgExecutionTimeMs = execTimeCount > 0 ? Math.round(totalExecTime / execTimeCount) : 0;

  // B. Last Sync Time (from settings)
  const { data: pollSetting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'biometric_last_poll_time')
    .maybeSingle();
  const lastSyncTime = pollSetting?.value || null;

  // C. Connected Devices (from biometric_devices)
  const { count: connectedDevicesCount, error: devicesErr } = await supabase
    .from('biometric_devices')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Online');

  // D. Last Device Response (most recent completed/failed command response)
  const { data: lastResp } = await supabase
    .from('biometric_actions')
    .select('device_response, verification_result, updated_at')
    .or('device_response.neq.null,verification_result.neq.null')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastDeviceResponse = lastResp 
    ? (lastResp.device_response || lastResp.verification_result || null) 
    : null;

  return {
    pendingCount,
    executingCount,
    verifyingCount,
    completedCount,
    failedCount,
    avgExecutionTimeMs,
    lastSyncTime,
    connectedDevicesCount: connectedDevicesCount || 0,
    lastDeviceResponse
  };
}

// 2. Fetch Inspector command list
export async function getInspectorCommands(filters: {
  status?: string;
  action?: string;
  search?: string;
}): Promise<InspectorCommandItem[]> {
  await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();

  let query = supabase
    .from('biometric_actions')
    .select('*, members(full_name), staff(full_name)');

  if (filters.status && filters.status !== 'all') {
    if (filters.status === 'pending') {
      query = query.in('status', ['pending', 'sent']);
    } else {
      query = query.eq('status', filters.status);
    }
  }

  if (filters.action && filters.action !== 'all') {
    query = query.eq('action', filters.action);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);

  if (error) {
    console.error('Error fetching inspector commands:', error);
    throw new Error('Failed to fetch command log');
  }

  let results = (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    staff_id: row.staff_id,
    biometric_id: row.biometric_id,
    action: row.action,
    disable_method: row.disable_method,
    status: row.status,
    notes: row.notes,
    device_response: row.device_response,
    verification_result: row.verification_result,
    execution_time_ms: row.execution_time_ms,
    error_message: row.error_message,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    entity_name: row.members?.full_name || row.staff?.full_name || 'Unknown',
    entity_type: row.staff_id ? 'staff' : 'member' as 'member' | 'staff'
  }));

  if (filters.search && filters.search.trim()) {
    const s = filters.search.trim().toLowerCase();
    results = results.filter(r => 
      r.id.toLowerCase().includes(s) ||
      r.biometric_id.includes(s) ||
      (r.entity_name && r.entity_name.toLowerCase().includes(s)) ||
      (r.notes && r.notes.toLowerCase().includes(s))
    );
  }

  return results;
}

// 3. Retry Failed Command
export async function retryBiometricCommand(commandId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const adminSupabase = createAdminClient();

    const { data: cmd, error: fetchErr } = await adminSupabase
      .from('biometric_actions')
      .select('*, members(full_name), staff(full_name)')
      .eq('id', commandId)
      .single();

    if (fetchErr || !cmd) return { success: false, error: 'Command not found' };

    const name = cmd.members?.full_name || cmd.staff?.full_name || 'Unknown';

    const { error: updateErr } = await adminSupabase
      .from('biometric_actions')
      .update({
        status: 'pending',
        device_response: null,
        verification_result: null,
        execution_time_ms: null,
        error_message: null,
        completed_at: null,
        notes: `Retried by operator at ${new Date().toLocaleTimeString()}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (updateErr) throw updateErr;

    await logAudit(`Retried failed biometric command for: ${name} (Action: ${cmd.action})`, 'Biometrics', user.id);
    
    revalidatePath('/devices/command-center');
    revalidatePath('/devices/inspector');

    return { success: true };
  } catch (err: any) {
    console.error('Error in retryBiometricCommand:', err);
    return { success: false, error: err.message || 'Retry failed' };
  }
}

// 4. Cancel Command
export async function cancelBiometricCommand(commandId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const adminSupabase = createAdminClient();

    const { data: cmd, error: fetchErr } = await adminSupabase
      .from('biometric_actions')
      .select('*, members(full_name), staff(full_name)')
      .eq('id', commandId)
      .single();

    if (fetchErr || !cmd) return { success: false, error: 'Command not found' };

    const name = cmd.members?.full_name || cmd.staff?.full_name || 'Unknown';

    // Mark as failed/cancelled
    const { error: updateErr } = await adminSupabase
      .from('biometric_actions')
      .update({
        status: 'failed',
        error_message: 'Cancelled by operator',
        notes: `Cancelled by operator at ${new Date().toLocaleTimeString()}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', commandId);

    if (updateErr) throw updateErr;

    await logAudit(`Cancelled pending biometric command for: ${name} (Action: ${cmd.action})`, 'Biometrics', user.id);
    
    revalidatePath('/devices/command-center');
    revalidatePath('/devices/inspector');

    return { success: true };
  } catch (err: any) {
    console.error('Error in cancelBiometricCommand:', err);
    return { success: false, error: err.message || 'Cancellation failed' };
  }
}
