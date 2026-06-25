import { getSettings } from '@/lib/actions/settings';
import { createClient } from '@/lib/supabase/server';

/**
 * Clean phone number to E.164 format (removing spaces, dashes, etc.)
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

/**
 * Replace placeholders in template strings
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value);
  }
  return result;
}

export const BUILTIN_TEMPLATES = {
  Welcome: 'Hello {{member_name}},\nWelcome to FusionFit Gym.\nWe are excited to be part of your fitness journey.',
  Renewal: 'Hello {{member_name}},\nYour membership expires on {{expiry_date}}.\nPlease renew your membership to continue training without interruption.',
  ExpiryWarning: 'Hello {{member_name}},\nYour membership will expire in {{days_left}} days.\nPlease renew to avoid interruption.',
  Payment: 'Hello {{member_name}},\nYour payment is pending.\nPlease contact us to complete your payment.',
  Invoice: 'Hi {{member_name}},\nYour FusionFit Gym invoice is ready.\nInvoice No: {{invoice_number}}\nAmount: ₹{{amount}}\nView Invoice:\n{{invoice_link}}\nThank you.\n- FusionFit Gym',
  Expired: 'Hello {{member_name}},\nYour membership has expired.\nPlease contact us to renew your membership.',
};

/**
 * Core function to insert SMS notifications into the queue and record logs
 */
export async function sendSMS(
  memberId: string | null,
  phone: string,
  message: string,
  smsType: string,
  isManual = false
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = cleanPhoneNumber(phone);
  if (!cleanPhone) {
    return { success: false, error: 'Invalid phone number' };
  }
  
  // 1. Fetch SMS settings from settings table
  let settings;
  try {
    settings = await getSettings();
  } catch (err: any) {
    console.error('Failed to retrieve settings for SMS:', err);
    return { success: false, error: 'Database settings lookup failed' };
  }
  
  const supabase = await createClient();

  // 2. Fallback check for table column structure
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

  // 3. Check if SMS system is enabled globally
  if (!settings.sms_enabled) {
    try {
      const logData: Record<string, any> = {
        member_id: memberId,
        message,
        status: 'Skipped',
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

  // 4. Check automation specific settings (if not manual)
  if (!isManual) {
    let isAutomationEnabled = true;
    
    // Check specific automation flags
    if (smsType === 'Welcome') {
      isAutomationEnabled = !!settings.sms_automation_new_member;
    } else if (smsType === 'Renewal') {
      isAutomationEnabled = !!settings.sms_automation_payment; // Fallback to payment
    } else if (smsType.startsWith('Expiry Warning')) {
      if (smsType.includes('7')) {
        isAutomationEnabled = !!settings.sms_automation_expires_7;
      } else if (smsType.includes('3')) {
        isAutomationEnabled = !!settings.sms_automation_expires_3;
      } else if (smsType.includes('0')) {
        isAutomationEnabled = !!settings.sms_automation_expires_today;
      } else {
        isAutomationEnabled = !!settings.sms_automation_expires_3;
      }
    } else if (smsType === 'Expired') {
      isAutomationEnabled = !!settings.sms_automation_expired;
    } else if (smsType === 'Invoice') {
      isAutomationEnabled = !!settings.sms_automation_invoice;
    } else if (smsType === 'Payment Reminder') {
      isAutomationEnabled = !!settings.sms_automation_payment;
    }

    if (!isAutomationEnabled) {
      try {
        const logData: Record<string, any> = {
          member_id: memberId,
          message,
          status: 'Skipped',
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

  // 5. Write record to sms_logs with status 'Pending' (notification queue)
  try {
    const logData: Record<string, any> = {
      member_id: memberId,
      message,
      status: 'Pending',
    };
    logData[phoneCol] = cleanPhone;
    logData[typeCol] = smsType;

    if (!isModern) {
      logData.provider_response = 'Queued for manual dispatch via device SMS app';
    }

    const { error: insertError } = await supabase.from('sms_logs').insert(logData);
    if (insertError) {
      throw insertError;
    }
  } catch (dbErr: any) {
    console.error('Failed to write pending SMS log:', dbErr);
    return { success: false, error: dbErr?.message || 'Database write error' };
  }

  return { success: true };
}

/**
 * Automations Wrapper Functions
 */

export async function sendInvoiceSMS(
  memberId: string,
  invoiceNumber: string,
  plan: string,
  amount: number,
  phone: string,
  memberName = 'Member',
  invoiceLink?: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.Invoice, {
    member_name: memberName,
    invoice_number: invoiceNumber,
    amount: String(amount),
    invoice_link: invoiceLink || '',
  });
  return sendSMS(memberId, phone, message, 'Invoice');
}

export async function sendRenewalSMS(
  memberId: string,
  name: string,
  expiryDate: string,
  phone: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.Renewal, { member_name: name, expiry_date: expiryDate });
  return sendSMS(memberId, phone, message, 'Renewal');
}

export async function sendExpiryWarningSMS(
  memberId: string,
  name: string,
  phone: string,
  daysLeft = 3
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.ExpiryWarning, { member_name: name, days_left: String(daysLeft) });
  return sendSMS(memberId, phone, message, `Expiry Warning (${daysLeft} days)`);
}

export async function sendExpiredMembershipSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.Expired, { member_name: name });
  return sendSMS(memberId, phone, message, 'Expired');
}

export async function sendWelcomeSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.Welcome, { member_name: name });
  return sendSMS(memberId, phone, message, 'Welcome');
}

export async function sendPaymentReminderSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = renderTemplate(BUILTIN_TEMPLATES.Payment, { member_name: name });
  return sendSMS(memberId, phone, message, 'Payment Reminder');
}
