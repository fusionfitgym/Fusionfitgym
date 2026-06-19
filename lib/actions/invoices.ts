"use server";

import { createClient } from '@/lib/supabase/server';
import { Invoice, InvoiceFormValues } from '@/types';
import { sendInvoiceSMS } from '@/lib/sms';
import { validateRole } from './auth';
import { logAudit } from './audit';

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, member:members(full_name, phone, email, address, membership_plan)')
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
    .select('*, member:members(full_name, phone, email, address, membership_plan)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Invoice;
}

export async function createInvoice(values: InvoiceFormValues): Promise<Invoice> {
  const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .insert([{ ...values, invoice_number: '' }])
    .select()
    .single();
  if (error) throw error;

  await logAudit(`Created invoice: ${data.invoice_number} (Amount: ₹${data.amount})`, 'Invoices', user.id);

  // Retrieve member details to send automated invoice SMS
  try {
    const { data: member } = await supabase
      .from('members')
      .select('phone, membership_plan')
      .eq('id', values.member_id)
      .single();

    if (member && member.phone) {
      await sendInvoiceSMS(
        data.member_id,
        data.invoice_number,
        member.membership_plan,
        data.amount,
        member.phone
      );
    }
  } catch (smsErr) {
    console.error('Failed to trigger invoice notification SMS:', smsErr);
  }

  return data as Invoice;
}

export async function updateInvoiceStatus(id: string, status: Invoice['status']): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function updateInvoicePdfUrl(id: string, pdf_url: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('invoices').update({ pdf_url }).eq('id', id);
  if (error) throw error;
}
