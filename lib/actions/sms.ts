"use server";

import { createClient } from '@/lib/supabase/server';
import { SMSLog, SMSFilterParams, SMSAnalyticsStats } from '@/types';
import { sendSMS } from '@/lib/sms';
import { getSMSNotificationService, categorizeSMSError } from '@/lib/notification-service';
import { getSettings } from '@/lib/actions/settings';

async function detectModernSchema(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Server-side paginated, filtered, and searchable SMS Logs fetcher for enterprise scale
 */
export async function getSMSLogsServerAction(params: SMSFilterParams = {}): Promise<{
  logs: SMSLog[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(10, params.limit || 20));
  const offset = (page - 1) * limit;

  let query = supabase
    .from('sms_logs')
    .select(
      `
      id,
      member_id,
      member_name,
      phone,
      phone_number,
      sms_type,
      message_type,
      message,
      invoice_id,
      gateway,
      provider,
      status,
      error_message,
      http_status,
      textbee_message_id,
      provider_message_id,
      retry_count,
      resend_count,
      attempt_count,
      last_retry_at,
      last_resend_at,
      last_attempt_at,
      failure_category,
      auto_retry_eligible,
      created_at,
      updated_at,
      sent_at,
      provider_response,
      provider_metadata,
      member:members(full_name)
    `,
      { count: 'exact' }
    );

  // Status Filter
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status);
  }

  // Message Type Filter
  if (params.messageType && params.messageType !== 'all') {
    query = query.or(`message_type.eq.${params.messageType},sms_type.eq.${params.messageType}`);
  }

  // Search Filter (Member Name, Phone, Message, or Error)
  if (params.search && params.search.trim()) {
    const searchTerm = `%${params.search.trim()}%`;
    query = query.or(
      `member_name.ilike.${searchTerm},phone_number.ilike.${searchTerm},phone.ilike.${searchTerm},message.ilike.${searchTerm},error_message.ilike.${searchTerm}`
    );
  }

  // Date Range Filter
  const now = new Date();
  if (params.dateRange === 'today') {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    query = query.gte('created_at', todayStart);
  } else if (params.dateRange === 'week') {
    const weekAgo = new Date(now.valueOf() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', weekAgo);
  } else if (params.dateRange === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', monthStart);
  } else if (params.startDate || params.endDate) {
    if (params.startDate) query = query.gte('created_at', params.startDate);
    if (params.endDate) query = query.lte('created_at', params.endDate);
  }

  // Execute Paginated Query
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch SMS server logs:', error);
    throw error;
  }

  const logs: SMSLog[] = (data || []).map((row: any) => ({
    id: row.id,
    member_id: row.member_id,
    member_name: row.member_name || row.member?.full_name || 'Member',
    phone_number: row.phone_number || row.phone || '',
    phone: row.phone || row.phone_number || '',
    message_type: row.message_type || row.sms_type || 'General',
    sms_type: row.sms_type || row.message_type || 'General',
    message: row.message,
    invoice_id: row.invoice_id,
    gateway: row.gateway || row.provider || 'TextBee',
    provider: row.provider || row.gateway || 'textbee',
    status: row.status || 'Pending',
    error_message: row.error_message || row.provider_response || null,
    http_status: row.http_status || row.provider_metadata?.httpStatus || null,
    textbee_message_id: row.textbee_message_id || row.provider_message_id || null,
    provider_message_id: row.provider_message_id || row.textbee_message_id || null,
    retry_count: row.retry_count ?? row.resend_count ?? row.attempt_count ?? 0,
    resend_count: row.resend_count ?? row.retry_count ?? 0,
    attempt_count: row.attempt_count ?? row.retry_count ?? 0,
    last_retry_at: row.last_retry_at || row.last_resend_at || row.last_attempt_at || null,
    last_resend_at: row.last_resend_at || row.last_retry_at || null,
    last_attempt_at: row.last_attempt_at || row.last_retry_at || null,
    failure_category: row.failure_category || categorizeSMSError(row.error_message, row.http_status),
    auto_retry_eligible: row.auto_retry_eligible ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
    sent_at: row.sent_at || null,
    provider_response: row.provider_response || null,
    provider_metadata: row.provider_metadata || null,
    member: row.member,
  }));

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return { logs, total, page, totalPages };
}

/**
 * Backward compatible getSMSLogs helper
 */
export async function getSMSLogs(): Promise<SMSLog[]> {
  const res = await getSMSLogsServerAction({ limit: 100 });
  return res.logs;
}

/**
 * Execute a single SMS retry attempt
 */
export async function retrySMSDeliveryAction(logId: string): Promise<{
  success: boolean;
  message: string;
  log?: SMSLog;
}> {
  const supabase = await createClient();

  // 1. Fetch target log details
  const { data: log, error: fetchError } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('id', logId)
    .single();

  if (fetchError || !log) {
    return { success: false, message: 'SMS log entry not found.' };
  }

  // 2. Prevent duplicate retry if already delivered
  if (log.status === 'Sent') {
    return { success: false, message: 'SMS has already been delivered successfully.' };
  }

  const phone = log.phone_number || log.phone;
  if (!phone) {
    return { success: false, message: 'Recipient phone number is missing.' };
  }

  const nextRetryCount = (log.retry_count ?? log.resend_count ?? log.attempt_count ?? 0) + 1;
  const retryTime = new Date().toISOString();

  // 3. Mark status as 'Retrying' prior to gateway dispatch
  try {
    await supabase
      .from('sms_logs')
      .update({
        status: 'Retrying',
        retry_count: nextRetryCount,
        resend_count: nextRetryCount,
        attempt_count: nextRetryCount,
        last_retry_at: retryTime,
        last_resend_at: retryTime,
        last_attempt_at: retryTime,
      })
      .eq('id', logId);
  } catch (err) {
    console.warn('Pre-retry status update warning:', err);
  }

  // 4. Dispatch via SMSNotificationService
  const service = getSMSNotificationService();
  const result = await service.dispatch(logId, phone, log.message, log.member_id);

  // 5. Return updated log
  const { data: updatedLog } = await supabase
    .from('sms_logs')
    .select('*')
    .eq('id', logId)
    .single();

  if (result.success) {
    return {
      success: true,
      message: `SMS re-sent successfully via ${service['provider']?.name || 'TextBee'}.`,
      log: updatedLog as SMSLog,
    };
  } else {
    return {
      success: false,
      message: `Retry failed: ${result.error || 'Gateway error'}`,
      log: updatedLog as SMSLog,
    };
  }
}

/**
 * Bulk Retry Action for multiple selected SMS logs
 */
export async function bulkRetrySMSDeliveryAction(
  logIds: string[],
  temporaryOnly = false
): Promise<{
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  message: string;
}> {
  if (!logIds || logIds.length === 0) {
    return { success: true, processed: 0, succeeded: 0, failed: 0, message: 'No messages selected.' };
  }

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from('sms_logs')
    .select('id, status, failure_category, retry_count')
    .in('id', logIds);

  if (!logs || logs.length === 0) {
    return { success: false, processed: 0, succeeded: 0, failed: 0, message: 'No valid logs found.' };
  }

  let targetLogs = logs.filter((l) => l.status !== 'Sent');
  if (temporaryOnly) {
    targetLogs = targetLogs.filter((l) => l.failure_category !== 'permanent');
  }

  let succeeded = 0;
  let failed = 0;

  for (const logItem of targetLogs) {
    const res = await retrySMSDeliveryAction(logItem.id);
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    success: true,
    processed: targetLogs.length,
    succeeded,
    failed,
    message: `Completed retrying ${targetLogs.length} messages (${succeeded} succeeded, ${failed} failed).`,
  };
}

/**
 * Mark a failed or pending SMS as Cancelled
 */
export async function cancelSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('sms_logs')
    .update({ status: 'Cancelled', auto_retry_eligible: false })
    .eq('id', logId);

  if (error) return { success: false, message: error.message };
  return { success: true, message: 'SMS marked as cancelled.' };
}

/**
 * Enterprise SMS Analytics Action
 */
export async function getSMSAnalyticsAction(): Promise<SMSAnalyticsStats> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [
    { count: todaySent },
    { count: monthlySent },
    { count: failedCount },
    { count: pendingCount },
    { count: retryingCount },
    { count: renewalRemindersSent },
    { count: totalSent },
    { count: retryQueueCount },
  ] = await Promise.all([
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Sent').gte('created_at', todayStart),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Sent').gte('created_at', monthStart),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Failed'),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Retrying'),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Sent').or('message_type.eq.Renewal,sms_type.eq.Renewal'),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Sent'),
    supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Failed').eq('auto_retry_eligible', true),
  ]);

  const sentNum = todaySent ?? 0;
  const failedNum = failedCount ?? 0;
  const totalAttempts = sentNum + failedNum;
  const successRate = totalAttempts > 0 ? Math.round((sentNum / totalAttempts) * 100) : 100;

  // Failure cause distribution
  const { data: failedLogs } = await supabase
    .from('sms_logs')
    .select('error_message, provider_response, failure_category, http_status')
    .eq('status', 'Failed')
    .limit(200);

  const causeCounts: Record<string, { count: number; category: any }> = {};
  (failedLogs || []).forEach((row: any) => {
    const rawError = row.error_message || row.provider_response || 'Unknown Error';
    let cause = 'Unknown Error';

    if (rawError.includes('Device Offline') || rawError.includes('offline')) cause = 'Device Offline';
    else if (rawError.includes('timeout') || rawError.includes('Timeout')) cause = 'Gateway Timeout';
    else if (rawError.includes('invalid phone') || rawError.includes('Invalid')) cause = 'Invalid Number';
    else if (rawError.includes('Network') || rawError.includes('fetch failed')) cause = 'Network Error';
    else if (rawError.includes('Rate limit') || rawError.includes('429')) cause = 'Rate Limit';
    else if (row.http_status >= 500) cause = 'Gateway Server Error (5xx)';

    if (!causeCounts[cause]) {
      causeCounts[cause] = { count: 0, category: row.failure_category || 'temporary' };
    }
    causeCounts[cause].count++;
  });

  const failureCauses = Object.entries(causeCounts).map(([cause, obj]) => ({
    cause,
    count: obj.count,
    category: obj.category,
  }));

  // Daily Trends for past 7 days
  const dailyTrends: { date: string; sent: number; failed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.valueOf() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];

    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();

    const [{ count: dSent }, { count: dFailed }] = await Promise.all([
      supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Sent').gte('created_at', dayStart).lte('created_at', dayEnd),
      supabase.from('sms_logs').select('*', { count: 'exact', head: true }).eq('status', 'Failed').gte('created_at', dayStart).lte('created_at', dayEnd),
    ]);

    dailyTrends.push({
      date: dateStr,
      sent: dSent ?? 0,
      failed: dFailed ?? 0,
    });
  }

  return {
    todaySent: sentNum,
    monthlySent: monthlySent ?? 0,
    failed: failedNum,
    pending: pendingCount ?? 0,
    retrying: retryingCount ?? 0,
    renewalRemindersSent: renewalRemindersSent ?? 0,
    notificationQueue: (pendingCount ?? 0) + (failedNum ?? 0),
    totalSent: totalSent ?? 0,
    successRate,
    retryQueueCount: retryQueueCount ?? 0,
    failureCauses,
    dailyTrends,
  };
}

/**
 * Execute automatic retry queue background worker
 */
export async function executeAutoRetryQueueAction(): Promise<{
  success: boolean;
  retriedCount: number;
  message: string;
}> {
  const settings = await getSettings();

  if (settings.sms_auto_retry_enabled === 'false') {
    return { success: true, retriedCount: 0, message: 'Auto-retry disabled in settings.' };
  }

  const maxAttempts = parseInt(settings.sms_auto_retry_max_attempts || '3', 10);
  const temporaryOnly = settings.sms_retry_temporary_only !== 'false';

  const supabase = await createClient();
  let query = supabase
    .from('sms_logs')
    .select('id, retry_count, attempt_count, resend_count, last_retry_at')
    .eq('status', 'Failed')
    .eq('auto_retry_eligible', true);

  if (temporaryOnly) {
    query = query.eq('failure_category', 'temporary');
  }

  const { data: failedLogs } = await query.limit(20);

  if (!failedLogs || failedLogs.length === 0) {
    return { success: true, retriedCount: 0, message: 'No eligible failed messages in auto-retry queue.' };
  }

  const eligibleIds: string[] = [];
  failedLogs.forEach((item: any) => {
    const attempts = item.retry_count ?? item.attempt_count ?? item.resend_count ?? 0;
    if (attempts < maxAttempts) {
      eligibleIds.push(item.id);
    }
  });

  if (eligibleIds.length === 0) {
    return { success: true, retriedCount: 0, message: 'All failed messages have reached max retry attempts.' };
  }

  const bulkRes = await bulkRetrySMSDeliveryAction(eligibleIds, temporaryOnly);
  return {
    success: true,
    retriedCount: bulkRes.succeeded,
    message: `Auto-retry completed: ${bulkRes.succeeded} retried successfully out of ${eligibleIds.length}.`,
  };
}

/**
 * Existing getSMSStats helper for dashboard bar
 */
export async function getSMSStats() {
  const analytics = await getSMSAnalyticsAction();
  return {
    todaySent: analytics.todaySent,
    monthlySent: analytics.monthlySent,
    failed: analytics.failed,
    pending: analytics.pending,
    renewalRemindersSent: analytics.renewalRemindersSent,
    notificationQueue: analytics.notificationQueue,
    totalSent: analytics.totalSent,
    successRate: analytics.successRate,
    retryQueueCount: analytics.retryQueueCount,
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

/** Queue a pending SMS notification */
export async function queueSMSNotificationAction(
  memberId: string | null,
  phone: string,
  message: string,
  messageType: string,
  memberName?: string,
  invoiceId?: string
): Promise<{ success: boolean; message: string; logId?: string }> {
  try {
    const result = await sendSMS(memberId, phone, message, messageType, true, memberName, invoiceId);
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

/** Mark an SMS notification as sent */
export async function markSMSAsSentAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  const { data: log, error: fetchError } = await supabase
    .from('sms_logs')
    .select('member_id')
    .eq('id', logId)
    .single();

  if (fetchError || !log) {
    return { success: false, message: 'SMS log not found.' };
  }

  const { error } = await supabase
    .from('sms_logs')
    .update({ status: 'Sent', sent_at: new Date().toISOString() })
    .eq('id', logId);

  if (error) return { success: false, message: error.message };

  if (log.member_id) {
    await supabase
      .from('members')
      .update({
        sms_sent: true,
        sms_sent_at: new Date().toISOString(),
        sms_status: 'sent',
      })
      .eq('id', log.member_id);
  }

  return { success: true, message: 'Marked as sent.' };
}

/** Dismiss notification */
export async function dismissSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  return cancelSMSAction(logId);
}

/** Update message content */
export async function updateSMSMessageAction(
  logId: string,
  message: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from('sms_logs').update({ message }).eq('id', logId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Message updated.' };
}

/** Alias resendSMSAction -> retrySMSDeliveryAction */
export async function resendSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const res = await retrySMSDeliveryAction(logId);
  return { success: res.success, message: res.message };
}

/** Alias retrySMSAction -> retrySMSDeliveryAction */
export async function retrySMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  return resendSMSAction(logId);
}

/** Undo sent SMS */
export async function undoSMSSentAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();

  const { data: log, error: fetchError } = await supabase
    .from('sms_logs')
    .select('member_id')
    .eq('id', logId)
    .single();

  if (fetchError || !log) {
    return { success: false, message: 'SMS log not found.' };
  }

  const { error } = await supabase
    .from('sms_logs')
    .update({ status: 'Pending', sent_at: null })
    .eq('id', logId);

  if (error) return { success: false, message: error.message };

  if (log.member_id) {
    await supabase
      .from('members')
      .update({
        sms_sent: false,
        sms_sent_at: null,
        sms_status: 'pending',
      })
      .eq('id', log.member_id);
  }

  return { success: true, message: 'SMS status set back to Pending.' };
}

/** Duplicate SMS */
export async function duplicateSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data: log } = await supabase.from('sms_logs').select('*').eq('id', logId).single();
  if (!log) return { success: false, message: 'SMS log not found.' };

  const phone = log.phone_number || log.phone || '';
  const messageType = log.message_type || log.sms_type || 'Custom Communication';
  return queueSMSNotificationAction(log.member_id, phone, log.message, messageType, log.member_name);
}

/** Delete SMS record */
export async function deleteSMSAction(logId: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from('sms_logs').select('status').eq('id', logId).single();

  if (!data) return { success: false, message: 'SMS log not found.' };

  if (data.status === 'Pending') {
    return cancelSMSAction(logId);
  }

  const { error } = await supabase.from('sms_logs').delete().eq('id', logId);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Record removed.' };
}

/** @deprecated sendSMSAction alias */
export async function sendSMSAction(
  memberId: string | null,
  phone: string,
  message: string,
  messageType: string
): Promise<{ success: boolean; message: string }> {
  return queueSMSNotificationAction(memberId, phone, message, messageType);
}

/** Bulk send helper */
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
      const res = await sendSMS(target.memberId, target.phone, finalMessage, messageType, true, target.name);
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

/** Mark invoice notification as sent */
export async function markInvoiceNotificationSent(
  memberId: string,
  invoiceNumber?: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  let query = supabase.from('sms_logs').select('id').eq('member_id', memberId).eq('status', 'Pending');

  if (invoiceNumber) {
    query = query.ilike('message', `%${invoiceNumber}%`);
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(5);
  if (!data || data.length === 0) return { success: false, message: 'No pending invoice notification found.' };

  return markSMSAsSentAction(data[0].id);
}

export async function getSMSLogsByMember(memberId: string): Promise<SMSLog[]> {
  const res = await getSMSLogsServerAction({ search: memberId, limit: 100 });
  return res.logs;
}

export async function fetchReceivedSMSAction() {
  const { getTextBeeReceivedSMS } = await import('@/lib/textbee');
  return getTextBeeReceivedSMS();
}

export async function fetchSentMessagesAction(page = 1, limit = 20) {
  const { getTextBeeSentMessages } = await import('@/lib/textbee');
  return getTextBeeSentMessages(page, limit);
}

export async function fetchGatewayHealthAction() {
  const { getTextBeeGatewayHealth } = await import('@/lib/textbee');
  const health = await getTextBeeGatewayHealth();

  const supabase = await createClient();
  const { data: lastLog } = await supabase
    .from('sms_logs')
    .select('created_at')
    .eq('status', 'Sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastLog) {
    health.lastSmsSent = lastLog.created_at;
  }

  return health;
}
