"use server";

import { createClient } from '@/lib/supabase/server';
import { GymSettings } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

export async function getSettings(): Promise<GymSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;

  const map: Record<string, string> = {};
  data?.forEach(row => { map[row.key] = row.value; });

  return {
    gym_name:      map.gym_name      ?? 'FusionFit Gym',
    gym_phone:     map.gym_phone     ?? '',
    gym_email:     map.gym_email     ?? '',
    gym_address:   map.gym_address   ?? '',
    plan_monthly:  map.plan_monthly  ?? '1500',
    plan_quarterly: map.plan_quarterly ?? '4000',
    plan_biannual: map.plan_biannual ?? '7500',
    plan_annual:   map.plan_annual   ?? '14000',
    sms_provider_name: map.sms_provider_name ?? 'Generic HTTP API',
    sms_api_url:   map.sms_api_url   ?? '',
    sms_api_key:   map.sms_api_key   ?? '',
    sms_sender_id: map.sms_sender_id ?? 'FUSFIT',
    sms_enabled:   map.sms_enabled   === 'true',
  };
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

  await logAudit('Updated multiple gym settings', 'Settings', user.id);
}
