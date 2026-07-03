"use server";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GymSettings } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

export async function getSettings(): Promise<GymSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;

  const map: Record<string, string> = {};
  data?.forEach((row: any) => { map[row.key] = row.value; });

  return {
    gym_name:      map.gym_name      ?? 'FusionFit Gym',
    gym_phone:     map.gym_phone     ?? '',
    gym_email:     map.gym_email     ?? '',
    gym_address:   map.gym_address   ?? '',
    plan_monthly:  map.plan_monthly  ?? '1500',
    plan_quarterly: map.plan_quarterly ?? '4000',
    plan_biannual: map.plan_biannual ?? '7500',
    plan_annual:   map.plan_annual   ?? '14000',
    plan_ladies_wt_1m: map.plan_ladies_wt_1m ?? '1000',
    plan_ladies_ws_1m: map.plan_ladies_ws_1m ?? '1300',
    plan_ladies_wt_3m: map.plan_ladies_wt_3m ?? '2750',
    plan_ladies_ws_3m: map.plan_ladies_ws_3m ?? '3600',
    plan_ladies_wt_6m: map.plan_ladies_wt_6m ?? '5800',
    plan_ladies_ws_6m: map.plan_ladies_ws_6m ?? '7300',
    plan_gents_wt_1m: map.plan_gents_wt_1m ?? '1000',
    plan_gents_wc_1m: map.plan_gents_wc_1m ?? '1300',
    plan_gents_wt_3m: map.plan_gents_wt_3m ?? '2850',
    plan_gents_wc_3m: map.plan_gents_wc_3m ?? '3750',
    plan_gents_wt_6m: map.plan_gents_wt_6m ?? '5750',
    plan_gents_wc_6m: map.plan_gents_wc_6m ?? '7500',
    sms_provider_name: map.sms_provider_name ?? 'Generic HTTP API',
    sms_api_url:   map.sms_api_url   ?? '',
    sms_api_key:   map.sms_api_key   ?? '',
    sms_sender_id: map.sms_sender_id ?? 'FUSFIT',
    sms_enabled:   map.sms_enabled   === 'true',
    gym_logo:      map.gym_logo      ?? '/Logo.jpeg',
    sms_automation_new_member: map.sms_automation_new_member === 'true',
    sms_automation_expires_7:    map.sms_automation_expires_7    === 'true',
    sms_automation_expires_3:    map.sms_automation_expires_3    === 'true',
    sms_automation_expires_today:map.sms_automation_expires_today === 'true',
    sms_automation_expired:      map.sms_automation_expired      === 'true',
    sms_automation_invoice:      map.sms_automation_invoice      === 'true',
    sms_automation_payment:      map.sms_automation_payment      === 'true',
    // Invoice settings mapping
    invoice_prefix: map.invoice_prefix ?? 'INV',
    invoice_starting_number: map.invoice_starting_number ?? '1001',
    invoice_gst_percent: map.invoice_gst_percent ?? '0',
    invoice_currency: map.invoice_currency ?? '₹',
    invoice_footer: map.invoice_footer ?? 'Thank you for your business!',
    invoice_terms: map.invoice_terms ?? 'Terms & Conditions apply. Fees once paid are non-refundable.',
    invoice_auto_generation: map.invoice_auto_generation !== 'false',
  };
}

export async function uploadGymLogo(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const adminSupabase = createAdminClient();
    
    // Ensure the bucket exists
    const { data: buckets, error: listError } = await adminSupabase.storage.listBuckets();
    if (listError) {
      console.error('Failed to list buckets:', listError.message);
    }
    
    const bucketExists = buckets?.some(b => b.id === 'gym-assets');
    if (!bucketExists) {
      const { error: createError } = await adminSupabase.storage.createBucket('gym-assets', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        return { error: `Failed to create storage bucket: ${createError.message}` };
      }
    }

    const ext = file.name.split('.').pop();
    const filename = `gym-logo-${Date.now()}.${ext}`;
    const { error } = await adminSupabase.storage
      .from('gym-assets')
      .upload(filename, file, { upsert: true });
    if (error) return { error: error.message };

    const { data } = adminSupabase.storage.from('gym-assets').getPublicUrl(filename);
    return { url: data.publicUrl };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;

  await logAudit(`Updated setting: ${key} = ${value}`, 'Settings', user.id);
}

export async function upsertSettings(settings: Partial<GymSettings>): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw error;

  // Call sequence reset RPC if invoice_starting_number is updated
  if (settings.invoice_starting_number !== undefined) {
    const startNum = parseInt(settings.invoice_starting_number, 10);
    if (!isNaN(startNum) && startNum >= 1) {
      const { error: rpcError } = await supabase.rpc('set_invoice_sequence', { start_num: startNum });
      if (rpcError) {
        console.error('Failed to set invoice sequence via RPC:', rpcError);
      }
    }
  }

  await logAudit('Updated multiple gym settings', 'Settings', user.id);
}
