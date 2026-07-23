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
  if (!token || token.length < 4) return null;

  try {
    const supabase = createAdminClient();
    
    // First lookup by secure invoice_token
    const { data: tokenMatch } = await supabase
      .from('invoices')
      .select(
        '*, member:members(full_name, phone, email, address, package_name, package_duration, package_price, package_start_date, package_end_date)'
      )
      .eq('invoice_token', token)
      .maybeSingle();

    let data = tokenMatch;

    // Fallback: Check if token is UUID id (for legacy backward compatibility)
    if (!data) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
      if (isUuid) {
        const { data: idMatch } = await supabase
          .from('invoices')
          .select(
            '*, member:members(full_name, phone, email, address, package_name, package_duration, package_price, package_start_date, package_end_date)'
          )
          .eq('id', token)
          .maybeSingle();
        data = idMatch;
      }
    }

    if (!data) return null;

    const settings = await getPublicGymSettings();

    return {
      invoice: data as Invoice,
      settings,
    };
  } catch (err) {
    console.error('Failed to get public invoice by token:', err);
    return null;
  }
}
