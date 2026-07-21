"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Invoice, InvoiceFormValues } from '@/types';
import { sendInvoiceSMS } from '@/lib/sms';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { buildInvoicePublicUrl, generateInvoiceToken } from '@/lib/invoice-links';
import { formatDate } from '@/lib/utils';

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

export async function createInvoice(
  values: InvoiceFormValues
): Promise<{ data?: Invoice; error?: string }> {
  try {
    // 1. Verify every required field before inserting
    if (!values.member_id) {
      return { error: 'Member ID is required.' };
    }
    if (values.amount === undefined || values.amount === null || isNaN(Number(values.amount)) || Number(values.amount) <= 0) {
      return { error: 'Amount must be a numeric value greater than 0.' };
    }
    if (!values.due_date) {
      return { error: 'Due date is required.' };
    }
    if (!values.status || !['Paid', 'Pending', 'Overdue'].includes(values.status)) {
      return { error: 'Status must be one of Paid, Pending, or Overdue.' };
    }

    // 2. Validate due_date format before submission
    const parsedDate = new Date(values.due_date);
    if (isNaN(parsedDate.getTime())) {
      return { error: 'Invalid due date format.' };
    }

    // 3. Verify user authentication and permission role
    let userResult;
    try {
      userResult = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    } catch (authErr: any) {
      console.error('Authorization failed for createInvoice action:', authErr);
      return { error: authErr.message || 'Unauthorized. You do not have permission for this action.' };
    }
    const { user } = userResult;

    const supabase = await createClient();

    // 4. Verify selected member exists (Foreign key existence validation)
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id, membership_fee, parq_fee, admission_fee, trainer_fee, package_price, package_start_date, package_end_date')
      .eq('id', values.member_id)
      .maybeSingle();

    if (memberError) {
      console.error('Database error verifying member details:', memberError);
      return { error: `Failed to verify member: ${memberError.message}` };
    }
    if (!memberData) {
      return { error: 'The selected member does not exist.' };
    }

    let membership_fee = Number(values.amount);
    let parq_fee = 0;
    let admission_fee = 0;
    let trainer_fee = 0;

    if (Number(values.amount) === Number(memberData.package_price)) {
      membership_fee = memberData.membership_fee;
      parq_fee = memberData.parq_fee;
      admission_fee = memberData.admission_fee || 0;
      trainer_fee = memberData.trainer_fee || 0;
    }

    // 5. Insert invoice
    const insertPayload = {
      member_id: values.member_id,
      amount: Number(values.amount),
      due_date: memberData?.package_end_date || values.due_date, // Next Due Date = Membership Expiry Date
      status: values.status,
      notes: values.notes || null,
      membership_fee,
      parq_fee,
      admission_fee,
      trainer_fee,
      membership_start_date: memberData?.package_start_date || null,
      membership_expiry_date: memberData?.package_end_date || null,
      invoice_number: '' // Trigger will auto-generate
    };

    const { data, error } = await supabase
      .from('invoices')
      .insert([insertPayload])
      .select('*, member:members(full_name, phone, package_name)')
      .maybeSingle();

    if (error) {
      console.error('Database error inserting invoice:', error);
      // RLS Policy permission code check
      if (error.code === '42501') {
        return { error: 'Permission denied: Your role does not have database write permissions for invoices.' };
      }
      return { error: `Failed to insert invoice: ${error.message}` };
    }

    if (!data) {
      return { error: 'Failed to retrieve created invoice data from database.' };
    }

    await logAudit(`Created invoice: ${data.invoice_number} (Amount: ₹${data.amount})`, 'Invoices', user.id);

    const member = data.member as { full_name?: string; phone?: string; package_name?: string } | null;
    const token = data.invoice_token || (await ensureInvoiceToken(data.id));
    const invoiceLink = buildInvoicePublicUrl(token);

    try {
      if (member?.phone) {
        await sendInvoiceSMS(
          data.member_id,
          data.invoice_number,
          formatDate(data.created_at),
          member.package_name || 'Membership',
          Number(data.amount),
          data.payment_method || 'N/A',
          formatDate(data.membership_expiry_date || data.due_date),
          member.phone,
          member.full_name || 'Member'
        );
      }
    } catch (smsErr) {
      console.error('Failed to queue invoice SMS notification:', smsErr);
    }

    revalidatePath('/');
    revalidatePath('/invoices');
    revalidatePath('/sms');

    return { data: data as Invoice };
  } catch (err: any) {
    console.error('Unexpected exception during createInvoice action execution:', err);
    return { error: err.message || 'An unexpected server error occurred.' };
  }
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

export async function duplicateInvoice(id: string): Promise<{ data?: Invoice; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    // 1. Fetch original invoice
    const { data: original, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return { error: 'Invoice not found.' };
    }

    // Fetch current member details
    const { data: memberData } = await supabase
      .from('members')
      .select('package_start_date, package_end_date')
      .eq('id', original.member_id)
      .maybeSingle();

    // 2. Insert new invoice cloning most values
    const insertPayload = {
      member_id: original.member_id,
      amount: original.amount,
      due_date: memberData?.package_end_date || original.due_date, // Next Due Date = Membership Expiry Date
      status: 'Pending',
      notes: original.notes ? `Cloned from ${original.invoice_number}. ${original.notes}` : `Cloned from ${original.invoice_number}`,
      membership_fee: original.membership_fee || 0,
      parq_fee: original.parq_fee || 0,
      admission_fee: original.admission_fee || 0,
      trainer_fee: original.trainer_fee || 0,
      locker_fee: original.locker_fee || 0,
      diet_plan_fee: original.diet_plan_fee || 0,
      subtotal: original.subtotal || 0,
      discount: original.discount || 0,
      tax: original.tax || 0,
      paid_amount: 0,
      balance_due: original.amount,
      payment_method: null,
      transaction_id: null,
      payment_date: null,
      membership_start_date: memberData?.package_start_date || original.membership_start_date || null,
      membership_expiry_date: memberData?.package_end_date || original.membership_expiry_date || null,
      invoice_number: '' // Trigger will auto-generate
    };

    const { data, error: insertError } = await supabase
      .from('invoices')
      .insert([insertPayload])
      .select('*, member:members(full_name, phone, package_name)')
      .single();

    if (insertError) {
      console.error('Failed to duplicate invoice:', insertError);
      return { error: insertError.message };
    }

    await logAudit(`Duplicated invoice ${original.invoice_number} as ${data.invoice_number}`, 'Invoices', user.id);

    revalidatePath('/invoices');
    return { data: data as Invoice };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function cancelInvoice(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    const { data: invoice } = await supabase.from('invoices').select('invoice_number, paid_amount, balance_due, amount').eq('id', id).single();
    if (!invoice) return { success: false, error: 'Invoice not found' };

    const { error } = await supabase
      .from('invoices')
      .update({ status: 'Cancelled', balance_due: 0 })
      .eq('id', id);

    if (error) throw error;

    await logAudit(`Cancelled invoice ${invoice.invoice_number}`, 'Invoices', user.id);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recordAdditionalPayment(
  id: string,
  amount: number,
  paymentMethod: string,
  transactionId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    // Fetch current invoice details
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !invoice) {
      return { success: false, error: 'Invoice not found.' };
    }

    const currentPaid = Number(invoice.paid_amount || 0);
    const newPaid = currentPaid + amount;
    const totalAmount = Number(invoice.amount);
    const newBalance = Math.max(0, totalAmount - newPaid);

    let status: Invoice['status'] = 'Partially Paid';
    if (newPaid >= totalAmount) {
      status = 'Paid';
    } else if (newPaid <= 0) {
      status = 'Unpaid';
    }

    const updatePayload = {
      paid_amount: newPaid,
      balance_due: newBalance,
      status,
      payment_method: paymentMethod,
      transaction_id: transactionId || invoice.transaction_id || null,
      payment_date: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log the transaction
    await logAudit(`Recorded payment of ₹${amount} for invoice ${invoice.invoice_number}`, 'Invoices', user.id);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendManualInvoiceSMS(invoiceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, member:members(*)')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      return { success: false, error: 'Invoice not found.' };
    }

    const member = invoice.member as any;
    if (!member?.phone) {
      return { success: false, error: 'Member phone number is missing.' };
    }

    const token = invoice.invoice_token || (await ensureInvoiceToken(invoice.id));
    const invoiceLink = buildInvoicePublicUrl(token);

    await sendInvoiceSMS(
      invoice.member_id,
      invoice.invoice_number,
      formatDate(invoice.created_at),
      member.package_name || 'Membership',
      Number(invoice.amount),
      invoice.payment_method || 'N/A',
      formatDate(invoice.membership_expiry_date || invoice.due_date),
      member.phone,
      member.full_name || 'Member'
    );

    return { success: true };
  } catch (err: any) {
    console.error('Failed to send manual invoice SMS:', err);
    return { success: false, error: err.message || 'An unexpected error occurred.' };
  }
}
