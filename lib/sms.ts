import { normalizeToE164 } from './phone';
import { renderTemplate, BUILTIN_TEMPLATES } from './sms-templates';

export { renderTemplate, BUILTIN_TEMPLATES };

/**
 * Core function to insert SMS notifications into the queue and trigger async gateway dispatch
 */
export async function sendSMS(
  memberId: string | null,
  phone: string,
  message: string,
  smsType: string,
  isManual = false,
  memberName?: string,
  invoiceId?: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Normalize phone to E.164
  const cleanPhone = normalizeToE164(phone);
  if (!cleanPhone) {
    console.error(`[SMS Service] Invalid phone number rejected: ${phone}`);
    return { success: false, error: 'Invalid phone number' };
  }
  
  // 2. Fetch SMS settings from settings table
  const { getSettings } = await import('@/lib/actions/settings');
  const { createClient } = await import('@/lib/supabase/server');

  let settings;
  try {
    settings = await getSettings();
  } catch (err: any) {
    console.error('Failed to retrieve settings for SMS:', err);
    return { success: false, error: 'Database settings lookup failed' };
  }
  
  const supabase = await createClient();

  // 3. Fallback check for table column structure
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
  } catch (err) {
    console.error('Database connection or query issue during schema detection:', err);
  }

  // 3b. Resolve member name if missing
  let resolvedName = memberName || null;
  if (!resolvedName && memberId) {
    try {
      const { data: memberData } = await supabase
        .from('members')
        .select('full_name')
        .eq('id', memberId)
        .single();
      if (memberData?.full_name) {
        resolvedName = memberData.full_name;
      }
    } catch {}
  }

  // 4. Check if SMS system is enabled globally
  if (!settings.sms_enabled) {
    try {
      const logData: Record<string, any> = {
        member_id: memberId,
        member_name: resolvedName,
        message,
        status: 'Skipped',
        gateway: process.env.SMS_PROVIDER || 'textbee',
      };
      logData[phoneCol] = cleanPhone;
      logData[typeCol] = smsType;
      if (!isModern) {
        logData.provider_response = 'SMS notifications are disabled in settings';
      }
      await supabase.from('sms_logs').insert(logData);
    } catch (dbErr) {
      console.error('Failed to write skipped SMS log:', dbErr);
    }
    return { success: false, error: 'SMS notifications are disabled globally' };
  }

  // 5. Check automation specific settings (if not manual)
  if (!isManual) {
    let isAutomationEnabled = true;
    
    // Check specific automation flags
    if (smsType === 'Renewal') {
      isAutomationEnabled = !!settings.sms_automation_payment; // Fallback to payment
    } else if (smsType === 'Invoice') {
      isAutomationEnabled = !!settings.sms_automation_invoice;
    } else {
      // All other automated template types are disabled/decommissioned
      isAutomationEnabled = false;
    }

    if (!isAutomationEnabled) {
      try {
        const logData: Record<string, any> = {
          member_id: memberId,
          member_name: resolvedName,
          message,
          status: 'Skipped',
          gateway: process.env.SMS_PROVIDER || 'textbee',
        };
        logData[phoneCol] = cleanPhone;
        logData[typeCol] = smsType;
        if (!isModern) {
          logData.provider_response = `SMS automation for '${smsType}' is disabled`;
        }
        await supabase.from('sms_logs').insert(logData);
      } catch (dbErr) {
        console.error('Failed to write skipped SMS log:', dbErr);
      }
      return { success: false, error: `SMS automation for ${smsType} is disabled` };
    }
  }

  // 6. Generate notification key for deduplication / idempotency
  let notificationKey: string | null = null;
  if (!isManual && memberId) {
    if (smsType === 'Renewal') {
      const todayStr = new Date().toISOString().split('T')[0];
      notificationKey = `${memberId}_Renewal_${todayStr}`;
    } else if (smsType === 'Invoice') {
      const invoiceMatch = message.match(/Invoice No:\s*([^\n]+)/i) || message.match(/Invoice:\s*\n?([^\n]+)/i);
      const invoiceNo = invoiceMatch ? invoiceMatch[1].trim() : 'unknown';
      notificationKey = `${memberId}_Invoice_${invoiceNo}`;
    }
  }

  // 7. Write record to sms_logs with status 'Pending' (notification queue)
  let logId = '';
  try {
    const logData: Record<string, any> = {
      member_id: memberId,
      member_name: resolvedName,
      message,
      status: 'Pending',
      gateway: process.env.SMS_PROVIDER || 'textbee',
      provider: process.env.SMS_PROVIDER || 'textbee',
      invoice_id: invoiceId || null,
    };
    logData[phoneCol] = cleanPhone;
    logData[typeCol] = smsType;

    logData.notification_key = notificationKey;

    if (!isModern) {
      logData.provider_response = 'Queued for dispatch';
    }

    const { data: insertedLog, error: insertError } = await supabase
      .from('sms_logs')
      .insert(logData)
      .select('id')
      .single();

    if (insertError) {
      // Handle Postgres unique constraint violation gracefully
      if (insertError.code === '23505') {
        console.log(`[SMS Queue] Duplicate notification skipped (Idempotency key: ${notificationKey})`);
        return { success: false, error: 'Duplicate notification' };
      }
      throw insertError;
    }

    if (insertedLog) {
      logId = insertedLog.id;
    }
  } catch (dbErr: any) {
    console.error('Failed to write pending SMS log:', dbErr);
    return { success: false, error: dbErr?.message || 'Database write error' };
  }

  // 8. Execute gateway dispatch synchronously so TextBee request executes and updates DB log
  if (logId) {
    try {
      const { getSMSNotificationService } = await import('./sms-provider');
      const service = getSMSNotificationService();
      const dispatchRes = await service.dispatch(logId, cleanPhone, message, memberId);
      if (!dispatchRes.success) {
        return { success: false, error: dispatchRes.error || 'TextBee Gateway dispatch failed' };
      }
    } catch (dispatchErr: any) {
      console.error('[SMS Dispatch] Failed during gateway dispatch:', dispatchErr);
      return { success: false, error: dispatchErr?.message || 'Gateway dispatch exception' };
    }
  }

  return { success: true };
}

/**
 * Automations Wrapper Functions
 */

export async function sendInvoiceSMS(
  memberId: string,
  invoiceNumber: string,
  invoiceDate: string,
  planName: string,
  amount: number,
  paymentMethod: string,
  expiryDate: string,
  phone: string,
  memberName = 'Member'
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.invoice, {
    memberName: memberName,
    invoiceNumber: invoiceNumber,
    invoiceDate: invoiceDate,
    planName: planName,
    amount: String(amount),
    paymentMethod: paymentMethod || 'N/A',
    expiryDate: expiryDate,
    // legacy key fallbacks
    member_name: memberName,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    plan_name: planName,
    payment_method: paymentMethod || 'N/A',
    expiry_date: expiryDate,
  });
  return sendSMS(memberId, phone, message, 'Invoice');
}

export async function sendRenewalSMS(
  memberId: string,
  name: string,
  planName: string,
  renewalDate: string,
  expiryDate: string,
  amount: number,
  phone: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.renewal, {
    memberName: name,
    planName: planName,
    renewalDate: renewalDate,
    expiryDate: expiryDate,
    amount: String(amount),
    // legacy key fallbacks
    member_name: name,
    plan_name: planName,
    renewal_date: renewalDate,
    expiry_date: expiryDate,
  });
  return sendSMS(memberId, phone, message, 'Renewal');
}
