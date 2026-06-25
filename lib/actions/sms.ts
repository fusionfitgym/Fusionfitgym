"use server";

import { createClient } from '@/lib/supabase/server';
import { SMSLog } from '@/types';
import { sendSMS } from '@/lib/sms';
import { getSettings } from '@/lib/actions/settings';

/**
 * Detect schema and fetch all SMS logs mapped to the modern structure
 */
export async function getSMSLogs(): Promise<SMSLog[]> {
  const supabase = await createClient();
  
  let phoneCol = 'phone';
  let typeCol = 'sms_type';
  let isModern = false;
  try {
    const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
    if (!error) {
      phoneCol = 'phone_number';
      typeCol = 'message_type';
      isModern = true;
    }
  } catch {}

  const selectQuery = isModern 
    ? 'id, member_id, phone_number, message_type, message, status, device_id, sent_at, created_at, member:members(full_name)'
    : 'id, member_id, phone, sms_type, message, status, provider_response, created_at, member:members(full_name)';

  const { data, error } = await supabase
    .from('sms_logs')
    .select(selectQuery)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Failed to load SMS logs:', error);
    throw error;
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    phone_number: isModern ? row.phone_number : row.phone,
    message_type: isModern ? row.message_type : row.sms_type,
    message: row.message,
    status: row.status,
    device_id: isModern ? row.device_id : null,
    sent_at: isModern ? row.sent_at : null,
    provider_response: isModern ? null : row.provider_response,
    created_at: row.created_at,
    member: row.member,
  })) as SMSLog[];
}

/**
 * Fetch connected device from DB or return a fallback mock device if table doesn't exist
 */
export async function getSMSDevice() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from('sms_devices')
      .select('*')
      .order('last_heartbeat', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return {
        ...data[0],
        is_mock: false,
      };
    }
  } catch {}

  // Fallback / Mock Device if migration not run yet
  return {
    id: 'mock-device-id',
    name: 'SMS Gateway Device',
    device_model: 'Samsung Galaxy S23 Ultra',
    android_version: 'Android 14',
    sim_number: '+91 98765 43210',
    battery_percentage: 85,
    signal_strength: 'Excellent',
    last_heartbeat: new Date().toISOString(),
    is_mock: true,
  };
}

/**
 * Calculate dashboard and page metrics for Communication Center
 */
export async function getSMSStats() {
  const supabase = await createClient();
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Detect schema for renewal reminder filter
  let isModern = false;
  try {
    const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
    if (!error) isModern = true;
  } catch {}

  const renewalFilter = isModern
    ? 'message_type.eq.Renewal,message_type.ilike.Expiry Warning%'
    : 'sms_type.eq.Renewal,sms_type.ilike.Expiry Warning%';

  const [
    { count: todaySent },
    { count: monthlySent },
    { count: failedCount },
    { count: pendingCount },
    { count: renewalRemindersSent },
  ] = await Promise.all([
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Failed'),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending'),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .or(renewalFilter),
  ]);

  const device = await getSMSDevice();
  const lastHeartbeatDate = device?.last_heartbeat ? new Date(device.last_heartbeat) : null;
  const isOnline = lastHeartbeatDate ? (now.getTime() - lastHeartbeatDate.getTime() < 5 * 60 * 1000) : false;

  return {
    todaySent: todaySent ?? 0,
    monthlySent: monthlySent ?? 0,
    failed: failedCount ?? 0,
    pending: pendingCount ?? 0,
    renewalRemindersSent: renewalRemindersSent ?? 0,
    deviceStatus: isOnline ? 'Online' : 'Offline',
    lastSync: device?.last_heartbeat ?? null,
  };
}

/**
 * Re-queue a failed SMS for delivery
 */
export async function retrySMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const logs = await getSMSLogs();
  const log = logs.find((l) => l.id === logId);
  if (!log) {
    return { success: false, message: 'SMS log not found.' };
  }
  if (log.status !== 'Failed') {
    return { success: false, message: 'Only failed messages can be retried.' };
  }
  const phone = log.phone_number || log.phone || '';
  const messageType = log.message_type || log.sms_type || 'Custom Communication';
  return sendSMSAction(log.member_id, phone, log.message, messageType);
}

/**
 * Cancel or remove a queued SMS
 */
export async function deleteSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from('sms_logs')
    .select('status')
    .eq('id', logId)
    .single();

  if (fetchError || !data) {
    return { success: false, message: 'SMS log not found.' };
  }

  if (data.status === 'Pending') {
    const { error } = await supabase
      .from('sms_logs')
      .update({ status: 'Cancelled' })
      .eq('id', logId);
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Message cancelled successfully.' };
  }

  const { error } = await supabase.from('sms_logs').delete().eq('id', logId);
  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true, message: 'Message removed successfully.' };
}

/**
 * Server action to trigger a manual SMS
 */
export async function sendSMSAction(
  memberId: string | null,
  phone: string,
  message: string,
  messageType: string
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await sendSMS(memberId, phone, message, messageType, true);
    if (result.success) {
      return { success: true, message: 'Message successfully queued for delivery.' };
    } else {
      return { success: false, message: `Failed to queue SMS: ${result.error}` };
    }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message || String(error)}` };
  }
}

/**
 * Server action to trigger a test SMS
 */
export async function sendTestSMSAction(phone: string): Promise<{ success: boolean; message: string }> {
  return sendSMSAction(null, phone, 'FusionFit Gym - This is a test SMS message to verify your connected phone connection.', 'Test');
}

/**
 * Server action to trigger bulk SMS sending
 */
export async function sendBulkSMSAction(
  targets: { memberId: string | null; phone: string; name: string }[],
  messageTemplate: string,
  messageType: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let count = 0;
    for (const target of targets) {
      let finalMessage = messageTemplate;
      if (target.name) {
        finalMessage = messageTemplate.replace(/{{\s*member_name\s*}}/g, target.name);
      }
      const res = await sendSMS(target.memberId, target.phone, finalMessage, messageType, true);
      if (res.success) count++;
    }
    return { success: true, count };
  } catch (error: any) {
    return { success: false, count: 0, error: error.message || String(error) };
  }
}

/**
 * Server action to test phone connection (heartbeat update + test SMS)
 */
export async function testConnectionAction(): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const settings = await getSettings();
  
  try {
    // 1. Update heartbeat of device in DB if table exists
    const device = await getSMSDevice();
    if (device && !device.is_mock) {
      await supabase
        .from('sms_devices')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('id', device.id);
    }
    
    // 2. Queue a test message to the gym's own number if available
    const testPhone = settings.gym_phone || '+91 98765 43210';
    const res = await sendSMS(
      null,
      testPhone,
      'FusionFit Gym - Connection test ping generated successfully.',
      'Test',
      true
    );

    if (res.success) {
      return { success: true, message: 'Connection pinged successfully. Test SMS queued.' };
    } else {
      return { success: false, message: `Failed to queue test SMS: ${res.error}` };
    }
  } catch (error: any) {
    return { success: false, message: `Failed to ping connection: ${error.message || String(error)}` };
  }
}

/**
 * Fetch logs for a specific member mapped fallback-safely
 */
export async function getSMSLogsByMember(memberId: string): Promise<SMSLog[]> {
  const supabase = await createClient();
  let phoneCol = 'phone';
  let typeCol = 'sms_type';
  let isModern = false;
  try {
    const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
    if (!error) {
      phoneCol = 'phone_number';
      typeCol = 'message_type';
      isModern = true;
    }
  } catch {}

  const selectQuery = isModern 
    ? 'id, member_id, phone_number, message_type, message, status, device_id, sent_at, created_at'
    : 'id, member_id, phone, sms_type, message, status, provider_response, created_at';

  const { data, error } = await supabase
    .from('sms_logs')
    .select(selectQuery)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error(`Failed to fetch SMS logs for member ${memberId}:`, error);
    throw error;
  }
  
  return (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    phone_number: isModern ? row.phone_number : row.phone,
    message_type: isModern ? row.message_type : row.sms_type,
    message: row.message,
    status: row.status,
    device_id: isModern ? row.device_id : null,
    sent_at: isModern ? row.sent_at : null,
    provider_response: isModern ? null : row.provider_response,
    created_at: row.created_at,
  })) as SMSLog[];
}
