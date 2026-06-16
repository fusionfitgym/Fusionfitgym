"use server";

import { createClient } from '@/lib/supabase/server';
import { SMSLog } from '@/types';
import { sendSMS } from '@/lib/sms';

/**
 * Fetch all SMS logs from the database joined with the member name
 */
export async function getSMSLogs(): Promise<SMSLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sms_logs')
    .select('*, member:members(full_name)')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Failed to load SMS logs:', error);
    throw error;
  }
  
  return data as SMSLog[];
}

/**
 * Calculate dashboard and page metrics for SMS logs
 */
export async function getSMSStats() {
  const supabase = await createClient();
  
  // Total Sent (status = 'Sent')
  const { count: totalSent } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Sent');

  // Total Failed (status = 'Failed')
  const { count: failed } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Failed');

  // Today's Sent
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todaySent } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Sent')
    .gte('created_at', todayStart.toISOString());

  // Today's Failed
  const { count: todayFailed } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Failed')
    .gte('created_at', todayStart.toISOString());

  // Monthly Sent (from start of month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const { count: monthlySent } = await supabase
    .from('sms_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Sent')
    .gte('created_at', monthStart.toISOString());

  // Calculate Success Rate: Sent / (Sent + Failed) over all attempts
  const sentCount = totalSent ?? 0;
  const failedCount = failed ?? 0;
  const totalAttempts = sentCount + failedCount;
  const successRate = totalAttempts > 0 ? Math.round((sentCount / totalAttempts) * 100) : 100;

  return {
    totalSent: sentCount,
    failed: failedCount,
    todaySent: todaySent ?? 0,
    todayFailed: todayFailed ?? 0,
    monthlyCost: (monthlySent ?? 0) * 0.25,
    successRate,
  };
}

/**
 * Server action to trigger a test SMS
 */
export async function sendTestSMSAction(phone: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await sendSMS(
      null,
      phone,
      'FusionFit Gym - This is a test SMS message to verify your gateway configuration.',
      'Test'
    );
    
    if (result.success) {
      return { success: true, message: 'Test SMS sent successfully!' };
    } else {
      return { success: false, message: `Failed to send SMS: ${result.error}` };
    }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message || String(error)}` };
  }
}
