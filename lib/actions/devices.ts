"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { BiometricDevice } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

export async function getDevices(): Promise<BiometricDevice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('biometric_devices')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data as BiometricDevice[];
}

export async function createDevice(values: Omit<BiometricDevice, 'id' | 'created_at' | 'updated_at'>): Promise<{ data?: BiometricDevice; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('biometric_devices')
      .insert([values])
      .select()
      .single();
    if (error) return { error: error.message };

    await logAudit(`Created biometric device: ${data.name} (${data.serial_number})`, 'Devices', user.id);

    revalidatePath('/devices');
    return { data: data as BiometricDevice };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function updateDevice(id: string, values: Partial<BiometricDevice>): Promise<{ data?: BiometricDevice; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('biometric_devices')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };

    await logAudit(`Updated biometric device: ${data.name}`, 'Devices', user.id);

    revalidatePath('/devices');
    return { data: data as BiometricDevice };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function deleteDevice(id: string): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();

  const { data: device } = await supabase
    .from('biometric_devices')
    .select('name, serial_number')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('biometric_devices').delete().eq('id', id);
  if (error) throw error;

  await logAudit(`Deleted biometric device: ${device?.name || id}`, 'Devices', user.id);
  revalidatePath('/devices');
}
