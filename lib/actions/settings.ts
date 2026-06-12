"use server";

import { createClient } from '@/lib/supabase/server';
import { GymSettings } from '@/types';

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
  };
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

export async function upsertSettings(settings: Partial<GymSettings>): Promise<void> {
  const supabase = await createClient();
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase
    .from('settings')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}
