"use server";

import { createClient } from '@/lib/supabase/server';
import { BiometricDevice } from '@/types';

export async function getDevices(): Promise<BiometricDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .order('device_name', { ascending: true });
  if (error) throw error;
  return data as BiometricDevice[];
}
