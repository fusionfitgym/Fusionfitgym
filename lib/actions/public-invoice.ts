"use server";

import { createAdminClient } from '@/lib/supabase/admin';
import { Invoice, GymSettings } from '@/types';

export type PublicInvoiceData = {
  invoice: Invoice;
  settings: Pick<
    GymSettings,
    'gym_name' | 'gym_address' | 'gym_phone' | 'gym_email' | 'gym_logo'
  >;
};

async function getPublicGymSettings() {
  const supabase = createAdminClient();
  const { data } = await supabase.from('settings').select('key, value');
  const map: Record<string, string> = {};
  data?.forEach((row: { key: string; value: string }) => {
    map[row.key] = row.value;
  });
  return {
    gym_name: map.gym_name ?? 'FusionFit Gym',
    gym_phone: map.gym_phone ?? '',
    gym_email: map.gym_email ?? '',
    gym_address: map.gym_address ?? '',
    gym_logo: map.gym_logo ?? '/Logo.jpeg',
  };
}

/**
 * Fetch invoice + gym branding for the public invoice page (no auth required).
 * Access is gated by possession of the unique invoice token.
 */
export async function getPublicInvoiceByToken(token: string): Promise<PublicInvoiceData | null> {
  if (!token || token.length < 8) return null;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('invoices')
      .select(
        '*, member:members(full_name, phone, email, address, package_name, package_duration, package_price, package_start_date, package_end_date)'
      )
      .eq('invoice_token', token)
      .single();

    if (error || !data) return null;

    const settings = await getPublicGymSettings();

    return {
      invoice: data as Invoice,
      settings,
    };
  } catch {
    return null;
  }
}
