'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  PTTrainer,
  PTTrainerFormValues,
  ptTrainerSchema,
  PTPackage,
  PTPackageFormValues,
  ptPackageSchema,
  PTClient,
  PTClientFormValues,
  ptClientSchema,
  PTSession,
  PTSessionFormValues,
  ptSessionSchema,
  PTProgress,
  PTProgressFormValues,
  ptProgressSchema,
  PTInvoice,
  PTInvoiceFormValues,
  ptInvoiceSchema,
  PTPayment,
  PTPaymentFormValues,
  ptPaymentSchema,
  PTCommission,
  PTNotification,
} from '@/types/pt';
import { validateRole } from './auth';
import { logAudit } from './audit';

// ── 1. Trainers CRUD ─────────────────────────────────────────

export async function getPTTrainers(): Promise<PTTrainer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_trainers')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTTrainer[];
}

export async function getPTTrainerById(id: string): Promise<PTTrainer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_trainers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) return null;
  return data as PTTrainer;
}

export async function createPTTrainer(values: PTTrainerFormValues): Promise<{ data?: PTTrainer; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const validated = ptTrainerSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_trainers')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Created PT Trainer: ${data.full_name}`, 'PT', user.id);
    revalidatePath('/pt/trainers');
    return { data: data as PTTrainer };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updatePTTrainer(id: string, values: Partial<PTTrainerFormValues>): Promise<{ data?: PTTrainer; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_trainers')
      .update(values)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Updated PT Trainer: ${data.full_name}`, 'PT', user.id);
    revalidatePath('/pt/trainers');
    return { data: data as PTTrainer };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deletePTTrainer(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    // Soft delete
    const { data: trainer } = await supabase
      .from('pt_trainers')
      .select('full_name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('pt_trainers')
      .update({ deleted_at: new Date().toISOString(), status: 'Inactive' })
      .eq('id', id);

    if (error) return { error: error.message };

    await logAudit(`Deleted PT Trainer: ${trainer?.full_name || id}`, 'PT', user.id);
    revalidatePath('/pt/trainers');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 2. Packages CRUD ─────────────────────────────────────────

export async function getPTPackages(): Promise<PTPackage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_packages')
    .select('*, trainer:pt_trainers(full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTPackage[];
}

export async function getPTPackageById(id: string): Promise<PTPackage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_packages')
    .select('*, trainer:pt_trainers(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) return null;
  return data as PTPackage;
}

export async function createPTPackage(values: PTPackageFormValues): Promise<{ data?: PTPackage; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const validated = ptPackageSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_packages')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Created PT Package: ${data.package_name}`, 'PT', user.id);
    revalidatePath('/pt/packages');
    return { data: data as PTPackage };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updatePTPackage(id: string, values: Partial<PTPackageFormValues>): Promise<{ data?: PTPackage; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_packages')
      .update(values)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Updated PT Package: ${data.package_name}`, 'PT', user.id);
    revalidatePath('/pt/packages');
    return { data: data as PTPackage };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deletePTPackage(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { data: pkg } = await supabase
      .from('pt_packages')
      .select('package_name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('pt_packages')
      .update({ deleted_at: new Date().toISOString(), status: 'Inactive' })
      .eq('id', id);

    if (error) return { error: error.message };

    await logAudit(`Deleted PT Package: ${pkg?.package_name || id}`, 'PT', user.id);
    revalidatePath('/pt/packages');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 3. Clients CRUD ──────────────────────────────────────────

export async function getPTClients(): Promise<PTClient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_clients')
    .select('*, trainer:pt_trainers(full_name), package:pt_packages(package_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTClient[];
}

export async function getPTClientById(id: string): Promise<PTClient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_clients')
    .select('*, trainer:pt_trainers(*), package:pt_packages(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) return null;
  return data as PTClient;
}

export async function createPTClient(values: PTClientFormValues): Promise<{ data?: PTClient; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const validated = ptClientSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_clients')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Registered PT Client: ${data.full_name}`, 'PT', user.id);
    revalidatePath('/pt/members');
    return { data: data as PTClient };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updatePTClient(id: string, values: Partial<PTClientFormValues>): Promise<{ data?: PTClient; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_clients')
      .update(values)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Updated PT Client: ${data.full_name}`, 'PT', user.id);
    revalidatePath('/pt/members');
    revalidatePath(`/pt/members/${id}`);
    return { data: data as PTClient };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deletePTClient(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { data: client } = await supabase
      .from('pt_clients')
      .select('full_name')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('pt_clients')
      .update({ deleted_at: new Date().toISOString(), status: 'Inactive' })
      .eq('id', id);

    if (error) return { error: error.message };

    await logAudit(`Deleted PT Client: ${client?.full_name || id}`, 'PT', user.id);
    revalidatePath('/pt/members');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 4. Sessions CRUD ─────────────────────────────────────────

export async function getPTSessions(): Promise<PTSession[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_sessions')
    .select('*, client:pt_clients(full_name), trainer:pt_trainers(full_name)')
    .order('session_date', { ascending: true })
    .order('session_time', { ascending: true });
  if (error) throw error;
  return data as PTSession[];
}

export async function getPTSessionById(id: string): Promise<PTSession | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_sessions')
    .select('*, client:pt_clients(*), trainer:pt_trainers(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as PTSession;
}

export async function createPTSession(values: PTSessionFormValues): Promise<{ data?: PTSession; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const validated = ptSessionSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_sessions')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    // Fetch details for audit log
    const { data: detail } = await supabase
      .from('pt_sessions')
      .select('client:pt_clients(full_name), trainer:pt_trainers(full_name)')
      .eq('id', data.id)
      .single();

    await logAudit(`Scheduled session: client ${detail?.client?.full_name} with ${detail?.trainer?.full_name}`, 'PT', user.id);
    revalidatePath('/pt/schedule');
    return { data: data as PTSession };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updatePTSession(id: string, values: Partial<PTSessionFormValues>): Promise<{ data?: PTSession; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_sessions')
      .update(values)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath('/pt/schedule');
    revalidatePath('/pt/attendance');
    return { data: data as PTSession };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deletePTSession(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    const { error } = await supabase
      .from('pt_sessions')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    revalidatePath('/pt/schedule');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 5. Session Attendance ─────────────────────────────────────

export async function getPTSessionAttendance(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_session_attendance')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data;
}

export async function markPTSessionAttendance(
  sessionId: string,
  clientId: string,
  trainerId: string,
  date: string,
  status: 'Present' | 'Absent' | 'Cancelled' | 'Late'
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    // 1. Log the attendance record
    const { error: attError } = await supabase
      .from('pt_session_attendance')
      .insert([{
        session_id: sessionId,
        client_id: clientId,
        trainer_id: trainerId,
        attendance_date: date,
        status,
        marked_by: user.id
      }]);

    if (attError) return { error: attError.message };

    // 2. Update the session status accordingly
    let sessionStatus: 'Scheduled' | 'Completed' | 'Missed' | 'Cancelled' | 'Rescheduled' = 'Scheduled';
    if (status === 'Present' || status === 'Late') {
      sessionStatus = 'Completed';
    } else if (status === 'Absent') {
      sessionStatus = 'Missed';
    } else if (status === 'Cancelled') {
      sessionStatus = 'Cancelled';
    }

    const { error: sessError } = await supabase
      .from('pt_sessions')
      .update({ status: sessionStatus })
      .eq('id', sessionId);

    if (sessError) return { error: sessError.message };

    revalidatePath('/pt/attendance');
    revalidatePath('/pt/schedule');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 6. Progress Tracking ─────────────────────────────────────

export async function getPTProgress(clientId: string): Promise<PTProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_progress')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data as PTProgress[];
}

export async function createPTProgress(values: PTProgressFormValues): Promise<{ data?: PTProgress; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const validated = ptProgressSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_progress')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath(`/pt/members/${validated.client_id}`);
    return { data: data as PTProgress };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deletePTProgress(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    const { data: progress } = await supabase
      .from('pt_progress')
      .select('client_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('pt_progress')
      .delete()
      .eq('id', id);

    if (error) return { error: error.message };

    if (progress) {
      revalidatePath(`/pt/members/${progress.client_id}`);
    }
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 7. Payments & Invoices ────────────────────────────────────

export async function getPTInvoices(): Promise<PTInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_invoices')
    .select('*, client:pt_clients(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTInvoice[];
}

export async function getPTInvoiceById(id: string): Promise<PTInvoice | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_invoices')
    .select('*, client:pt_clients(*), trainer:pt_trainers(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as PTInvoice;
}

export async function createPTInvoice(values: PTInvoiceFormValues): Promise<{ data?: PTInvoice; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const validated = ptInvoiceSchema.parse(values);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_invoices')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(`Created PT Invoice: ${data.invoice_number}`, 'PT', user.id);
    revalidatePath('/pt/invoices');
    return { data: data as PTInvoice };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updatePTInvoice(id: string, values: Partial<PTInvoiceFormValues>): Promise<{ data?: PTInvoice; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pt_invoices')
      .update(values)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath('/pt/invoices');
    revalidatePath(`/pt/invoices/${id}`);
    return { data: data as PTInvoice };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function getPTPayments(): Promise<PTPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_payments')
    .select('*, client:pt_clients(full_name), invoice:pt_invoices(invoice_number)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTPayment[];
}

export async function createPTPayment(values: PTPaymentFormValues): Promise<{ data?: PTPayment; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const validated = ptPaymentSchema.parse(values);
    const supabase = await createClient();

    // 1. Insert payment record
    const { data, error } = await supabase
      .from('pt_payments')
      .insert([validated])
      .select()
      .single();

    if (error) return { error: error.message };

    // 2. If it's linked to an invoice, update the invoice's paid amount & balance
    if (validated.invoice_id) {
      const { data: invoice } = await supabase
        .from('pt_invoices')
        .select('paid_amount, final_amount')
        .eq('id', validated.invoice_id)
        .single();

      if (invoice) {
        const newPaid = Number(invoice.paid_amount) + Number(validated.amount_paid);
        const newBalance = Math.max(0, Number(invoice.final_amount) - newPaid);
        const status = newBalance <= 0 ? 'Paid' : 'Pending';

        await supabase
          .from('pt_invoices')
          .update({
            paid_amount: newPaid,
            balance_due: newBalance,
            status,
            payment_method: validated.payment_method,
          })
          .eq('id', validated.invoice_id);
      }
    }

    await logAudit(`Collected PT Payment: ₹${data.amount_paid} from client ${data.client_id}`, 'PT', user.id);
    revalidatePath('/pt/payments');
    revalidatePath('/pt/invoices');
    return { data: data as PTPayment };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 8. Commissions ───────────────────────────────────────────

export async function getPTCommissions(): Promise<PTCommission[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_commissions')
    .select('*, trainer:pt_trainers(full_name), client:pt_clients(full_name), session:pt_sessions(session_date), invoice:pt_invoices(invoice_number)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTCommission[];
}

export async function payPTCommission(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { error } = await supabase
      .from('pt_commissions')
      .update({
        status: 'Paid',
        paid_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', id);

    if (error) return { error: error.message };

    await logAudit(`Paid PT Commission ID: ${id}`, 'PT', user.id);
    revalidatePath('/pt/trainers');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 9. Notifications ─────────────────────────────────────────

export async function getPTNotifications(): Promise<PTNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pt_notifications')
    .select('*, client:pt_clients(full_name), trainer:pt_trainers(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as PTNotification[];
}

export async function markPTNotificationAsRead(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('pt_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) return { error: error.message };
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ── 10. Dashboard Stats ──────────────────────────────────────

export async function getPTDashboardStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const [
    { data: clients },
    { data: todaySessions },
    { data: completedSessions },
    { data: remainingSessionsSum },
    { data: invoices },
    { data: pendingPayments },
    { data: commissions }
  ] = await Promise.all([
    // Active Clients
    supabase.from('pt_clients').select('id', { count: 'exact' }).eq('status', 'Active').is('deleted_at', null),
    // Today's Sessions
    supabase.from('pt_sessions').select('id', { count: 'exact' }).eq('session_date', today),
    // Completed Sessions
    supabase.from('pt_sessions').select('id', { count: 'exact' }).eq('status', 'Completed'),
    // Remaining Sessions (sum of remaining sessions of active client packages)
    supabase.from('pt_clients').select('sessions_remaining').eq('status', 'Active').is('deleted_at', null),
    // Monthly PT Revenue (sums of payments in this month)
    supabase.from('pt_payments').select('amount_paid, payment_date'),
    // Pending Payments (unpaid balance due on active invoices)
    supabase.from('pt_invoices').select('balance_due').eq('status', 'Pending'),
    // Trainer Commission (sum of pending and paid commissions)
    supabase.from('pt_commissions').select('amount, status')
  ]);

  const activeClientsCount = clients?.length || 0;
  const todaySessionsCount = todaySessions?.length || 0;
  const completedSessionsCount = completedSessions?.length || 0;
  const remainingSessionsCount = remainingSessionsSum?.reduce((acc: number, curr: any) => acc + (curr.sessions_remaining || 0), 0) || 0;

  // Monthly Revenue Calculation
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const monthlyRevenue = invoices
    ?.filter((p: any) => {
      const pDate = new Date(p.payment_date);
      return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
    })
    .reduce((acc: number, curr: any) => acc + Number(curr.amount_paid), 0) || 0;

  const pendingPaymentsAmount = pendingPayments?.reduce((acc: number, curr: any) => acc + Number(curr.balance_due), 0) || 0;

  const trainerCommissionPending = commissions?.filter((c: any) => c.status === 'Pending').reduce((acc: number, curr: any) => acc + Number(curr.amount), 0) || 0;

  // Expiring packages (clients whose expiry_date is in next 7 days)
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  const { data: expiringClients } = await supabase
    .from('pt_clients')
    .select('id')
    .eq('status', 'Active')
    .is('deleted_at', null)
    .gte('expiry_date', today)
    .lte('expiry_date', nextWeekStr);

  const expiringPackagesCount = expiringClients?.length || 0;

  return {
    activeClients: activeClientsCount,
    todaySessions: todaySessionsCount,
    completedSessions: completedSessionsCount,
    remainingSessions: remainingSessionsCount,
    monthlyRevenue,
    pendingPayments: pendingPaymentsAmount,
    trainerCommission: trainerCommissionPending,
    expiringPackages: expiringPackagesCount
  };
}
