"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { MembershipRenewal, Member } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { queueBiometricAction } from './members';
import { sendRenewalSMS } from '@/lib/sms';
import { sendAutoWhatsAppMessage } from '@/lib/wati';
import { formatDate } from '@/lib/utils';
import { getSettings } from './settings';

export interface RenewMembershipParams {
  memberId: string;
  packageName: string;
  duration: string;
  trainingType: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training';
  startDate: string;
  endDate: string;
  paymentMethod: string;
  packagePrice: number;
  discount?: number;
  tax?: number;
  finalAmount: number;
  notes?: string;
}

export async function renewMembership(params: RenewMembershipParams): Promise<{
  success: boolean;
  member?: Member;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    // 1. Fetch current member details
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('*')
      .eq('id', params.memberId)
      .single();

    if (memberErr || !member) {
      return { success: false, error: 'Member not found.' };
    }

    const previousPackage = member.package_name || member.duration || 'Standard';
    const previousStartDate = member.package_start_date;
    const previousEndDate = member.package_end_date;

    // Fetch user profile name for audit / history tracking
    let staffName = user.email || 'Staff';
    try {
      const { data: profile } = await supabase
        .from('users_profiles')
        .select('full_name')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (profile?.full_name) staffName = profile.full_name;
    } catch {
      // Fallback to email
    }

    // 2. Generate Renewal Invoice
    const discountVal = Number(params.discount || 0);
    const taxVal = Number(params.tax || 0);
    const finalAmountVal = Number(params.finalAmount || (params.packagePrice - discountVal + taxVal));

    const invoicePayload = {
      member_id: member.id,
      amount: finalAmountVal,
      due_date: params.endDate,
      status: 'Paid', // Renewals are generated upon payment
      notes: params.notes ? `Membership Renewal: ${params.notes}` : `Membership Renewal (${params.packageName})`,
      membership_fee: Number(params.packagePrice),
      subtotal: Number(params.packagePrice),
      discount: discountVal,
      tax: taxVal,
      paid_amount: finalAmountVal,
      balance_due: 0,
      payment_method: params.paymentMethod,
      payment_date: new Date().toISOString(),
      membership_start_date: params.startDate,
      membership_expiry_date: params.endDate,
      invoice_number: '' // Supabase trigger auto-generates format
    };

    const { data: invoiceData, error: invoiceErr } = await supabase
      .from('invoices')
      .insert([invoicePayload])
      .select()
      .single();

    if (invoiceErr) {
      console.error('Failed to create renewal invoice:', invoiceErr);
      return { success: false, error: `Failed to create renewal invoice: ${invoiceErr.message}` };
    }

    const createdInvoiceId = invoiceData.id;
    const createdInvoiceNumber = invoiceData.invoice_number;

    // 3. Update Member Record (Do NOT create duplicate member)
    const updatedMemberPayload = {
      package_name: params.packageName,
      package_duration: params.duration,
      duration: params.duration,
      training_type: params.trainingType,
      package_price: Number(params.packagePrice),
      membership_fee: Number(params.packagePrice),
      package_start_date: params.startDate,
      package_end_date: params.endDate,
      status: 'Active',
      biometric_status: 'ENABLED',
      updated_at: new Date().toISOString()
    };

    const { data: updatedMember, error: updateErr } = await supabase
      .from('members')
      .update(updatedMemberPayload)
      .eq('id', member.id)
      .select()
      .single();

    if (updateErr) {
      console.error('Failed to update member during renewal:', updateErr);
      return { success: false, error: `Failed to update member status: ${updateErr.message}` };
    }

    // 4. Create Renewal History Record in `membership_renewals`
    const renewalRecordPayload = {
      member_id: member.id,
      invoice_id: createdInvoiceId,
      renewal_date: new Date().toISOString(),
      previous_package: previousPackage,
      new_package: params.packageName,
      previous_start_date: previousStartDate,
      previous_end_date: previousEndDate,
      new_start_date: params.startDate,
      new_end_date: params.endDate,
      invoice_number: createdInvoiceNumber,
      amount: finalAmountVal,
      discount: discountVal,
      payment_method: params.paymentMethod,
      renewed_by: staffName,
      notes: params.notes || null,
    };

    const { error: renewalErr } = await supabase
      .from('membership_renewals')
      .insert([renewalRecordPayload]);

    if (renewalErr) {
      console.error('Failed to insert membership renewal record:', renewalErr);
      // Non-fatal logging
    }

    // 5. Extend Biometric Access
    if (member.biometric_user_id) {
      try {
        await queueBiometricAction(member.id, member.biometric_user_id, 'enable');
      } catch (bioErr) {
        console.error('Failed to queue biometric enable action on renewal:', bioErr);
      }
    }

    // 6. Send Automated Renewal SMS & WhatsApp
    if (member.phone) {
      const formattedRenewal = formatDate(params.startDate);
      const formattedExpiry = formatDate(params.endDate);
      
      try {
        await sendRenewalSMS(
          member.id,
          member.full_name,
          params.packageName,
          formattedRenewal,
          formattedExpiry,
          finalAmountVal,
          member.phone
        );
      } catch (smsErr) {
        console.error('Renewal SMS send error:', smsErr);
      }

      // WhatsApp non-blocking dispatch
      Promise.resolve().then(async () => {
        try {
          const settings = await getSettings();
          const whatsappMsg = `Hello ${member.full_name},\n\nYour Fusion Fit Gym membership has been successfully renewed.\n\nPackage: ${params.packageName}\nValid Until: ${formattedExpiry}\nInvoice: ${createdInvoiceNumber}\n\nThank you for choosing Fusion Fit Gym 💪`;
          await sendAutoWhatsAppMessage(
            member.phone,
            whatsappMsg,
            'membership_renewed',
            [
              { name: 'full_name', value: member.full_name },
              { name: 'package_name', value: params.packageName },
              { name: 'expiry_date', value: formattedExpiry },
              { name: 'invoice_number', value: createdInvoiceNumber },
            ],
            member.id
          );
        } catch (waErr) {
          console.error('WhatsApp renewal notification error:', waErr);
        }
      });
    }

    // 7. Audit Log
    await logAudit(
      `Renewed membership for ${member.full_name} (${params.packageName}, Valid until ${formatDate(params.endDate)}, Invoice #${createdInvoiceNumber})`,
      'Members',
      user.id
    );

    revalidatePath('/');
    revalidatePath('/members');
    revalidatePath(`/members/${member.id}`);
    revalidatePath('/invoices');

    return {
      success: true,
      member: updatedMember as Member,
      invoiceId: createdInvoiceId,
      invoiceNumber: createdInvoiceNumber,
    };
  } catch (err: any) {
    console.error('Unexpected error in renewMembership:', err);
    return { success: false, error: err?.message || 'An error occurred during renewal.' };
  }
}

export async function getMemberRenewals(memberId: string): Promise<MembershipRenewal[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('membership_renewals')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching member renewals:', error);
      return [];
    }

    return (data || []) as MembershipRenewal[];
  } catch (err) {
    console.error('Failed to get member renewals:', err);
    return [];
  }
}

export async function getDashboardRenewalStats() {
  try {
    const supabase = await createClient();
    const now = new Date();
    
    // Start of Today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    // Start of Current Month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    
    // Today Date string YYYY-MM-DD
    const yr = now.getFullYear();
    const mth = String(now.getMonth() + 1).padStart(2, '0');
    const dy = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yr}-${mth}-${dy}`;
    
    // 7 Days from now YYYY-MM-DD
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7Yr = in7Days.getFullYear();
    const in7Mth = String(in7Days.getMonth() + 1).padStart(2, '0');
    const in7Dy = String(in7Days.getDate()).padStart(2, '0');
    const in7DaysStr = `${in7Yr}-${in7Mth}-${in7Dy}`;

    const [
      { count: renewalsTodayCount },
      { count: renewalsMonthCount },
      { count: upcomingRenewalsCount },
      { count: expiredMembershipsCount }
    ] = await Promise.all([
      supabase.from('membership_renewals').select('id', { count: 'exact', head: true }).gte('renewal_date', todayStart),
      supabase.from('membership_renewals').select('id', { count: 'exact', head: true }).gte('renewal_date', monthStart),
      supabase.from('members')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'Active')
        .neq('duration', 'Daily Pass')
        .gte('package_end_date', todayStr)
        .lte('package_end_date', in7DaysStr),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Expired')
    ]);

    return {
      renewalsToday: renewalsTodayCount || 0,
      renewalsThisMonth: renewalsMonthCount || 0,
      upcomingRenewals: upcomingRenewalsCount || 0,
      expiredMemberships: expiredMembershipsCount || 0,
    };
  } catch (err) {
    console.error('Failed to get dashboard renewal stats:', err);
    return {
      renewalsToday: 0,
      renewalsThisMonth: 0,
      upcomingRenewals: 0,
      expiredMemberships: 0,
    };
  }
}
