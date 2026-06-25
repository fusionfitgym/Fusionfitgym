"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Invoice, InvoiceFormValues } from '@/types';
import { sendInvoiceSMS } from '@/lib/sms';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { buildInvoicePublicUrl, generateInvoiceToken } from '@/lib/invoice-links';

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, member:members(full_name, phone, email, address, package_name, package_duration, package_price, package_start_date, package_end_date)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function getInvoicesByMember(memberId: string): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, member:members(full_name, phone, email, address, package_name, package_duration, package_price, package_start_date, package_end_date)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Invoice;
}

/** Ensure an invoice has a public share token (backfill for legacy rows) */
export async function ensureInvoiceToken(invoiceId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_token')
    .eq('id', invoiceId)
    .single();

  if (data?.invoice_token) return data.invoice_token;

  const token = generateInvoiceToken();
  const { error } = await supabase
    .from('invoices')
    .update({ invoice_token: token })
    .eq('id', invoiceId);

  if (error) throw error;
  return token;
}

/** Regenerate the public invoice link (invalidates the previous URL) */
export async function regenerateInvoiceToken(invoiceId: string): Promise<string> {
  await validateRole(['Super Admin', 'Admin', 'Receptionist']);
  const supabase = await createClient();
  const token = generateInvoiceToken();
  const { error } = await supabase
    .from('invoices')
    .update({ invoice_token: token })
    .eq('id', invoiceId);

  if (error) throw error;
  revalidatePath('/sms');
  revalidatePath('/invoices');
  return token;
}

export async function createInvoice(values: InvoiceFormValues): Promise<Invoice> {
  const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
  const supabase = await createClient();

  // Retrieve member details to split amounts historically
  const { data: memberData } = await supabase
    .from('members')
    .select('membership_fee, parq_fee, package_price')
    .eq('id', values.member_id)
    .single();

  let membership_fee = values.amount;
  let parq_fee = 0;

  if (memberData) {
    if (Number(values.amount) === Number(memberData.package_price)) {
      membership_fee = memberData.membership_fee;
      parq_fee = memberData.parq_fee;
    } else {
      membership_fee = values.amount;
      parq_fee = 0;
    }
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert([{ ...values, membership_fee, parq_fee, invoice_number: '' }])
    .select('*, member:members(full_name, phone, package_name)')
    .single();
  if (error) throw error;

  await logAudit(`Created invoice: ${data.invoice_number} (Amount: ₹${data.amount})`, 'Invoices', user.id);

  const member = data.member as { full_name?: string; phone?: string; package_name?: string } | null;
  const token = data.invoice_token || (await ensureInvoiceToken(data.id));
  const invoiceLink = buildInvoicePublicUrl(token);

  try {
    if (member?.phone) {
      await sendInvoiceSMS(
        data.member_id,
        data.invoice_number,
        member.package_name || 'Membership',
        data.amount,
        member.phone,
        member.full_name || 'Member',
        invoiceLink
      );
    }
  } catch (smsErr) {
    console.error('Failed to queue invoice SMS notification:', smsErr);
  }

  revalidatePath('/');
  revalidatePath('/invoices');
  revalidatePath('/sms');
  return data as Invoice;
}

export async function updateInvoiceStatus(id: string, status: Invoice['status']): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
  if (error) throw error;
  revalidatePath('/');
  revalidatePath('/invoices');
}

export async function updateInvoicePdfUrl(id: string, pdf_url: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ pdf_url }).eq('id', id);
  if (error) throw error;
}
