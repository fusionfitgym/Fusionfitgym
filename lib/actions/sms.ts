"use server";

import { createClient } from '@/lib/supabase/server';
import { SMSLog } from '@/types';
import { sendSMS } from '@/lib/sms';

async function detectModernSchema(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Detect schema and fetch all SMS logs mapped to the modern structure
 */
export async function getSMSLogs(): Promise<SMSLog[]> {
  const supabase = await createClient();
  const isModern = await detectModernSchema(supabase);

  const selectQuery = isModern
    ? 'id, member_id, phone_number, message_type, message, status, sent_at, created_at, member:members(full_name)'
    : 'id, member_id, phone, sms_type, message, status, provider_response, created_at, member:members(full_name)';

  const { data, error } = await supabase
    .from('sms_logs')
    .select(selectQuery)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load SMS logs:', error);
    throw error;
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    member_id: row.member_id as string | null,
    phone_number: isModern ? (row.phone_number as string) : (row.phone as string),
    message_type: isModern ? (row.message_type as string) : (row.sms_type as string),
    message: row.message as string,
    status: row.status as string,
    sent_at: isModern ? (row.sent_at as string | null) : null,
    provider_response: isModern ? null : (row.provider_response as string | null),
    created_at: row.created_at as string,
    member: row.member as SMSLog['member'],
  })) as SMSLog[];
}

/**
 * Dashboard metrics for the SMS Notification Center
 */
export async function getSMSStats() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const isModern = await detectModernSchema(supabase);
  const renewalFilter = isModern
    ? 'message_type.eq.Renewal,message_type.ilike.Expiry Warning%'
    : 'sms_type.eq.Renewal,sms_type.ilike.Expiry Warning%';

  const [
    { count: todaySent },
    { count: monthlySent },
    { count: failedCount },
    { count: pendingCount },
    { count: renewalRemindersSent },
    { count: notificationQueue },
    { count: totalSent },
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
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'Failed']),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent'),
  ]);

  return {
    todaySent: todaySent ?? 0,
    monthlySent: monthlySent ?? 0,
    failed: failedCount ?? 0,
    pending: pendingCount ?? 0,
    renewalRemindersSent: renewalRemindersSent ?? 0,
    notificationQueue: notificationQueue ?? 0,
    totalSent: totalSent ?? 0,
  };
}

/** Pending SMS count for navigation badge */
export async function getPendingSMSCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Pending');
  return count ?? 0;
}

/**
 * Queue a pending SMS notification (ERP automation or manual)
 */
export async function queueSMSNotificationAction(
  memberId: string | null,
  phone: string,
  message: string,
  messageType: string
): Promise<{ success: boolean; message: string; logId?: string }> {
  try {
    const result = await sendSMS(memberId, phone, message, messageType, true);
    if (result.success) {
      return { success: true, message: 'Notification queued successfully.' };
    }
    return { success: false, message: result.error || 'Failed to queue notification.' };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Mark an SMS notification as sent after the user dispatches via native SMS app */
export async function markSMSAsSentAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  // Retrieve the log entry to get the member_id
  const { data: log, error: fetchError } = await supabase
    .from('sms_logs')
    .select('member_id')
    .eq('id', logId)
    .single();

  if (fetchError || !log) {
    return { success: false, message: 'SMS log not found or error loading log.' };
  }

  const { error } = await supabase
    .from('sms_logs')
    .update({ status: 'Sent', sent_at: new Date().toISOString() })
    .eq('id', logId);

  if (error) return { success: false, message: error.message };

  // If there's an associated member, update their SMS status
  if (log.member_id) {
    const { error: memberError } = await supabase
      .from('members')
      .update({
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
        sms_status: 'sent',
      })
      .eq('id', log.member_id);

    if (memberError) {
      console.error('Failed to update member SMS tracking info:', memberError);
      return {
        success: false,
        message: `SMS marked as sent, but member record update failed: ${memberError.message}`,
      };
    }
  }

  return { success: true, message: 'Marked as sent and member record updated.' };
}

/** Dismiss a notification without sending */
export async function dismissSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('sms_logs')
    .update({ status: 'Skipped' })
    .eq('id', logId);

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Notification dismissed.' };
}

/** Update the message body of a pending notification */
export async function updateSMSMessageAction(
  logId: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('sms_logs').update({ message }).eq('id', logId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Message updated.' };
}

/** Re-queue a failed or sent SMS as a new pending notification */
export async function resendSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const logs = await getSMSLogs();
  const log = logs.find((l) => l.id === logId);
  if (!log) return { success: false, message: 'SMS log not found.' };

  const phone = log.phone_number || log.phone || '';
  const messageType = log.message_type || log.sms_type || 'Custom Communication';
  return queueSMSNotificationAction(log.member_id, phone, log.message, messageType);
}

/** Duplicate an SMS as a new pending notification */
export async function duplicateSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  return resendSMSAction(logId);
}

/** Cancel or remove a queued SMS */
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
      .update({ status: 'Skipped' })
      .eq('id', logId);
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Notification dismissed.' };
  }

  const { error } = await supabase.from('sms_logs').delete().eq('id', logId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Record removed.' };
}

/** @deprecated Use queueSMSNotificationAction — kept for member detail compatibility */
export async function sendSMSAction(
  memberId: string | null,
  phone: string,
  message: string,
  messageType: string
): Promise<{ success: boolean; message: string }> {
  return queueSMSNotificationAction(memberId, phone, message, messageType);
}

/** @deprecated Use native SMS from client */
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
  } catch (error: unknown) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** @deprecated Use resendSMSAction */
export async function retrySMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  return resendSMSAction(logId);
}

/** Mark invoice-related pending SMS as sent */
export async function markInvoiceNotificationSent(
  memberId: string,
  invoiceNumber?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  let query = supabase
    .from('sms_logs')
    .select('id')
    .eq('member_id', memberId)
    .eq('status', 'Pending');

  const isModern = await detectModernSchema(supabase);
  if (isModern) {
    query = query.eq('message_type', 'Invoice');
  } else {
    query = query.eq('sms_type', 'Invoice');
  }

  if (invoiceNumber) {
    query = query.ilike('message', `%${invoiceNumber}%`);
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(5);

  if (!data || data.length === 0) {
    return { success: false, message: 'No pending invoice notification found.' };
  }

  const targetId = data[0].id;
  return markSMSAsSentAction(targetId);
}

export async function getSMSLogsByMember(memberId: string): Promise<SMSLog[]> {
  const supabase = await createClient();
  const isModern = await detectModernSchema(supabase);

  const selectQuery = isModern
    ? 'id, member_id, phone_number, message_type, message, status, sent_at, created_at'
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

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    member_id: row.member_id as string | null,
    phone_number: isModern ? (row.phone_number as string) : (row.phone as string),
    message_type: isModern ? (row.message_type as string) : (row.sms_type as string),
    message: row.message as string,
    status: row.status as string,
    sent_at: isModern ? (row.sent_at as string | null) : null,
    provider_response: isModern ? null : (row.provider_response as string | null),
    created_at: row.created_at as string,
  })) as SMSLog[];
}
