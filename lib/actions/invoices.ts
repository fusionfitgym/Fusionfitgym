"use server";

import { createClient } from '@/lib/supabase/server';
import { Invoice, InvoiceFormValues } from '@/types';

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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .insert([{ ...values, invoice_number: '' }])
    .select()
    .single();
  if (error) throw error;
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
