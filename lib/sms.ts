import { getSettings } from '@/lib/actions/settings';
import { createClient } from '@/lib/supabase/server';

/**
 * Clean phone number to E.164 format (removing spaces, dashes, etc.)
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^+\d]/g, '');
}

/**
 * Execute HTTP API call with retries
 */
async function sendSMSWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delayMs = 1000
): Promise<{ success: boolean; responseText: string }> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      
      if (res.ok) {
        return { success: true, responseText: text };
      }
      
      attempt++;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      } else {
        return { success: false, responseText: `HTTP ${res.status}: ${text}` };
      }
    } catch (err: any) {
      attempt++;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      } else {
        return { success: false, responseText: err?.message || String(err) };
      }
    }
  }
  return { success: false, responseText: 'Max retries reached' };
}

/**
 * Core function to send SMS notifications and record logs
 */
export async function sendSMS(
  memberId: string | null,
  phone: string,
  message: string,
  smsType: 'Invoice' | 'Welcome' | 'Renewal' | 'Expiry Warning' | 'Expired' | 'Test'
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = cleanPhoneNumber(phone);
  
  // 1. Fetch SMS settings from settings table
  let settings;
  try {
    settings = await getSettings();
  } catch (err: any) {
    console.error('Failed to retrieve settings for SMS:', err);
    return { success: false, error: 'Database settings lookup failed' };
  }
  
  const supabase = await createClient();

  // 2. Check if SMS notifications are enabled
  if (!settings.sms_enabled) {
    // Log in database as "Skipped"
    try {
      await supabase.from('sms_logs').insert({
        member_id: memberId,
        phone: cleanPhone,
        sms_type: smsType,
        message,
        status: 'Skipped',
        provider_response: 'SMS notifications are disabled in settings',
      });
    } catch (dbErr) {
      console.error('Failed to write skipped SMS log:', dbErr);
    }
    return { success: false, error: 'SMS notifications are disabled' };
  }

  // 3. Check if API URL is configured
  if (!settings.sms_api_url) {
    try {
      await supabase.from('sms_logs').insert({
        member_id: memberId,
        phone: cleanPhone,
        sms_type: smsType,
        message,
        status: 'Failed',
        provider_response: 'SMS API URL is not configured',
      });
    } catch (dbErr) {
      console.error('Failed to write failed SMS log:', dbErr);
    }
    return { success: false, error: 'SMS API URL is not configured' };
  }

  // 4. Build fetch options based on URL placeholder structure
  let url = settings.sms_api_url;
  let options: RequestInit = {};

  const hasPlaceholders = 
    url.includes('{phone}') || 
    url.includes('{message}') || 
    url.includes('{api_key}') || 
    url.includes('{sender_id}');

  if (hasPlaceholders) {
    // Perform placeholder replacement (HTTP GET typical setup)
    url = url
      .replace('{phone}', encodeURIComponent(cleanPhone))
      .replace('{message}', encodeURIComponent(message))
      .replace('{sender_id}', encodeURIComponent(settings.sms_sender_id ?? ''))
      .replace('{api_key}', encodeURIComponent(settings.sms_api_key ?? ''));
    
    options = {
      method: 'GET',
    };
  } else {
    // Default to HTTP POST with JSON payload
    options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.sms_api_key ?? ''}`,
        'X-API-Key': settings.sms_api_key ?? '',
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message,
        sender_id: settings.sms_sender_id,
      }),
    };
  }

  // 5. Send HTTP API request with retry logic
  const result = await sendSMSWithRetry(url, options);

  // 6. Write record to sms_logs
  try {
    await supabase.from('sms_logs').insert({
      member_id: memberId,
      phone: cleanPhone,
      sms_type: smsType,
      message,
      status: result.success ? 'Sent' : 'Failed',
      provider_response: result.responseText.substring(0, 1000), // Protect database against oversized payload text
    });
  } catch (dbErr) {
    console.error('Failed to write send result SMS log:', dbErr);
  }

  return { success: result.success, error: result.success ? undefined : result.responseText };
}

/**
 * Automations Wrapper Functions
 */

export async function sendInvoiceSMS(
  memberId: string,
  invoiceNumber: string,
  plan: string,
  amount: number,
  phone: string
) {
  const message = `FusionFit Gym\n\nInvoice Generated\n\nInvoice: ${invoiceNumber}\nPlan: ${plan}\nAmount: ₹${amount}\n\nThank you for choosing FusionFit Gym.`;
  return sendSMS(memberId, phone, message, 'Invoice');
}

export async function sendRenewalSMS(
  memberId: string,
  name: string,
  expiryDate: string,
  phone: string
) {
  const message = `Dear ${name},\n\nYour membership has been successfully renewed.\n\nValid Until: ${expiryDate}\n\nThank you for choosing FusionFit Gym.`;
  return sendSMS(memberId, phone, message, 'Renewal');
}

export async function sendExpiryWarningSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = `Dear ${name},\n\nYour FusionFit Gym membership expires in 3 days.\n\nPlease renew your membership.`;
  return sendSMS(memberId, phone, message, 'Expiry Warning');
}

export async function sendExpiredMembershipSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = `Dear ${name},\n\nYour FusionFit Gym membership has expired.\n\nPlease renew to continue access.`;
  return sendSMS(memberId, phone, message, 'Expired');
}

export async function sendWelcomeSMS(
  memberId: string,
  name: string,
  phone: string
) {
  const message = `Welcome to FusionFit Gym.\n\nYour membership has been successfully activated.\n\nFor assistance contact reception.`;
  return sendSMS(memberId, phone, message, 'Welcome');
}
