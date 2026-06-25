"use server";

import { createClient } from '@/lib/supabase/server';
import { BiometricDevice } from '@/types';

export async function getDevices(): Promise<BiometricDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
  .from('biometric_devices')
  .select('*');

console.log('DEVICES:', data);
  if (error) throw error;
  return data as BiometricDevice[];
}
