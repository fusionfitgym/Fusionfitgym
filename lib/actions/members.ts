"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Member, MemberFormValues, memberSchema } from '@/types';
import { sendRenewalSMS } from '@/lib/sms';
import { sendAutoWhatsAppMessage } from '@/lib/wati';
import { formatDate } from '@/lib/utils';
import { validateRole } from './auth';
import { logAudit } from './audit';

export async function getMembers(): Promise<Member[]> {
  try {
    await autoUpdateExpiredMembers();
  } catch (err) {
    console.error('Failed autoUpdateExpiredMembers in getMembers:', err);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, phone, email, join_date, status, profile_photo, package_name, package_duration, package_price, package_start_date, package_end_date, biometric_user_id, machine_type, duration, training_type')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Member[];
}

export async function getMemberById(id: string): Promise<Member | null> {
  try {
    await autoUpdateExpiredMembers();
  } catch (err) {
    console.error('Failed autoUpdateExpiredMembers in getMemberById:', err);
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Member;
}

export async function createMember(values: MemberFormValues): Promise<{ data?: Member; error?: string; invoiceId?: string | null }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    
    // Validate inputs server-side
    const validatedValues = memberSchema.parse(values);
    
    const supabase = await createClient();

    // Server-side uniqueness check: biometric_user_id must be unique per machine
    if (validatedValues.biometric_user_id) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('biometric_user_id', validatedValues.biometric_user_id)
        .eq('machine_type', validatedValues.machine_type)
        .limit(1);
      if (existing && existing.length > 0) {
        return { error: `Biometric ID ${validatedValues.biometric_user_id} already exists on ${validatedValues.machine_type} Machine.` };
      }
    }

    // Extract invoice-specific fields that do not belong to the members table
    const {
      discount = 0,
      tax = 0,
      payment_method = '',
      paid_amount = 0,
      pt_package_id,
      ...memberInsertData
    } = validatedValues as any;

    // Convert empty string to null to avoid unique constraint violations
    if (memberInsertData.biometric_user_id === '') {
      memberInsertData.biometric_user_id = null;
    }

    const { data: member, error } = await supabase
      .from('members')
      .insert([memberInsertData])
      .select()
      .single();
    if (error) return { error: error.message };

    // Queue biometric enable action if biometric_user_id is provided at creation
    if (member.biometric_user_id) {
      await queueBiometricAction(member.id, member.biometric_user_id, 'enable');
    }

    await logAudit(`Created member: ${member.full_name}`, 'Members', user.id);



    let createdInvoiceId = null;

    // Fetch gym settings to check auto generation
    const { getSettings } = await import('./settings');
    const settings = await getSettings();

    if (settings.invoice_auto_generation) {
      const membershipFee = Number(member.membership_fee || 0);
      const parqFee = Number(member.parq_fee || 0);
      const trainerFee = Number(member.trainer_fee || 0);
      const admissionFee = Number(member.admission_fee || 0);
      const lockerFee = Number(member.locker_fee || 0);
      const dietPlanFee = Number(member.diet_plan_fee || 0);

      const subtotal = membershipFee + parqFee + trainerFee + admissionFee + lockerFee + dietPlanFee;
      
      const taxRate = 0;
      const taxAmount = 0;
      
      const discountAmount = Number(discount || 0);
      const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);

      const paidVal = Number(paid_amount || 0);
      const balanceDue = Math.max(0, grandTotal - paidVal);

      let invoiceStatus: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending' | 'Overdue' = 'Pending';
      if (paidVal >= grandTotal && grandTotal > 0) {
        invoiceStatus = 'Paid';
      } else if (paidVal > 0) {
        invoiceStatus = 'Partially Paid';
      } else {
        invoiceStatus = 'Pending';
      }

      let trainerName = null;
      if (pt_package_id) {
        const { data: pkg } = await supabase
          .from('pt_packages')
          .select('*, trainer:pt_trainers(full_name)')
          .eq('id', pt_package_id)
          .maybeSingle();
        if (pkg?.trainer?.full_name) {
          trainerName = pkg.trainer.full_name;
        }
      }

      const invoicePayload = {
        member_id: member.id,
        amount: grandTotal,
        due_date: member.package_end_date, // Next Due Date = Membership Expiry Date
        status: invoiceStatus,
        notes: `Automatically generated invoice for new member registration.`,
        membership_fee: membershipFee,
        parq_fee: parqFee,
        admission_fee: admissionFee,
        trainer_fee: trainerFee,
        locker_fee: lockerFee,
        diet_plan_fee: dietPlanFee,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        paid_amount: paidVal,
        balance_due: balanceDue,
        payment_method: payment_method || null,
        transaction_id: null,
        payment_date: paidVal > 0 ? new Date().toISOString() : null,
        membership_start_date: member.package_start_date,
        membership_expiry_date: member.package_end_date,
        trainer_name: trainerName,
        invoice_number: '' // Trigger will generate
      };

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single();

      if (invoiceError) {
        console.error('Database error creating auto invoice:', invoiceError);
        // Rollback: delete created member
        await supabase.from('members').delete().eq('id', member.id);
        return { error: `Failed to automatically generate invoice: ${invoiceError.message}` };
      }

      createdInvoiceId = invoiceData.id;

      // Create PT client registration if PT package is selected
      if (pt_package_id) {
        try {
          const { data: ptPkg } = await supabase
            .from('pt_packages')
            .select('*')
            .eq('id', pt_package_id)
            .single();

          if (ptPkg) {
            const expiryDate = new Date(new Date(member.package_start_date).getTime() + Number(ptPkg.duration) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const ptClientPayload = {
              member_id: member.id,
              full_name: member.full_name,
              phone: member.phone,
              email: member.email || null,
              emergency_contact: member.emergency_contact || null,
              trainer_id: ptPkg.trainer_id,
              package_id: ptPkg.id,
              sessions_purchased: ptPkg.number_of_sessions,
              sessions_remaining: ptPkg.number_of_sessions,
              package_start_date: member.package_start_date,
              expiry_date: expiryDate,
              status: 'Active'
            };
            const { error: clientError } = await supabase
              .from('pt_clients')
              .insert([ptClientPayload]);
            if (clientError) {
              console.error('Failed to register PT client:', clientError);
            }
          }
        } catch (ptErr) {
          console.error('Error creating PT client entry:', ptErr);
        }
      }
    }

    // Trigger WhatsApp Welcome Message non-blocking
    if (member.phone) {
      const templateName = settings.default_welcome_template || 'welcome_member';
      const welcomeMsg = `Hello ${member.full_name},\n\nWelcome to FusionFit Gym! We're excited to have you on board.\nYour membership is now active.`;
      
      // Dispatch asynchronously without blocking return
      Promise.resolve().then(async () => {
        try {
          await sendAutoWhatsAppMessage(
            member.phone,
            welcomeMsg,
            templateName,
            [{
              name: 'full_name',
              value: member.full_name
            }],
            member.id
          );
        } catch (err) {
          console.error('[WhatsApp Log] Non-blocking WhatsApp dispatch failed:', err);
        }
      });
    }

    revalidatePath('/');
    revalidatePath('/members');
    return { data: member as Member, invoiceId: createdInvoiceId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function updateMember(id: string, values: Partial<MemberFormValues>): Promise<{ data?: Member; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();

    // Retrieve current member record to check status/plan changes and biometric ID shifts
    const { data: oldMember } = await supabase
      .from('members')
      .select('full_name, phone, package_start_date, package_end_date, status, package_name, biometric_user_id')
      .eq('id', id)
      .single();

    // Validate biometric_user_id specifically if it is updated (Requirement 3 & 4)
    if (values.biometric_user_id !== undefined) {
      const bioId = values.biometric_user_id;
      if (bioId && !/^\d+$/.test(bioId)) {
        throw new Error("Biometric User ID must contain numeric digits only");
      }

      // Check uniqueness when biometric_user_id or machine_type is changing
      const targetMachine = values.machine_type || undefined;
      if (bioId) {
        let q = supabase.from('members').select('id');
        q = q.eq('biometric_user_id', bioId);
        if (targetMachine) q = q.eq('machine_type', targetMachine);
        else q = q.eq('machine_type', (await supabase.from('members').select('machine_type').eq('id', id).single()).data?.machine_type || 'Gents');
        const { data: existing } = await q.limit(1);
        if (existing && existing.length > 0 && existing[0].id !== id) {
          return { error: `Biometric ID ${bioId} already exists on ${targetMachine || 'the assigned'} Machine.` };
        }
      }
    }

    const oldBioId = oldMember?.biometric_user_id;
    const newBioId = values.biometric_user_id;
    const isBioIdChanged = newBioId !== undefined && oldBioId !== newBioId;

    // Extract non-members table columns to prevent database exceptions
    const {
      id: _, // strip primary key
      discount,
      tax,
      payment_method,
      paid_amount,
      pt_package_id,
      ...allowedValues
    } = values as any;

    // Convert empty string to null to avoid unique constraint violations
    if (allowedValues.biometric_user_id === '') {
      allowedValues.biometric_user_id = null;
    }

    const { data, error } = await supabase
      .from('members')
      .update(allowedValues)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };

    // Process biometric status transitions based on the updated status
    if (data) {
      const nextBiometricStatus = data.status === 'Active' ? 'ENABLED' : 'DISABLED';
      if (data.biometric_status !== nextBiometricStatus) {
        await supabase
          .from('members')
          .update({ biometric_status: nextBiometricStatus })
          .eq('id', id);
        data.biometric_status = nextBiometricStatus;
      }

      // Queue block/delete command for old biometric mapping if changed
      if (isBioIdChanged && oldBioId) {
        const adminSupabase = createAdminClient();
        await adminSupabase.from('biometric_actions').insert({
          member_id: id,
          biometric_id: oldBioId,
          action: 'disable',
          disable_method: 'delete',
          status: 'pending',
          notes: `Auto-queued on Biometric ID change from ${oldBioId} to ${newBioId}`
        });
      }

      // Queue action for the new/current biometric ID
      if (data.biometric_user_id) {
        const actionType = nextBiometricStatus === 'ENABLED' ? 'enable' : 'disable';
        await queueBiometricAction(data.id, data.biometric_user_id, actionType);
      }
    }

    await logAudit(`Updated member profile: ${data.full_name}`, 'Members', user.id);

    // Trigger automated Renewal SMS if membership start shifted or reactivated to Active
    if (oldMember && data && data.phone) {
      const isPlanRenewed = (values.package_start_date && values.package_start_date !== oldMember.package_start_date) || (values.package_end_date && values.package_end_date !== oldMember.package_end_date);
      const isStatusActivated = (oldMember.status === 'Expired' || oldMember.status === 'Inactive') && data.status === 'Active';

      if (isPlanRenewed || isStatusActivated) {
        const formattedExpiry = formatDate(data.package_end_date);
        const formattedRenewal = formatDate(data.package_start_date);
        
        try {
          await sendRenewalSMS(
            data.id,
            data.full_name,
            data.package_name,
            formattedRenewal,
            formattedExpiry,
            Number(data.package_price || 0),
            data.phone
          );
        } catch (smsErr) {
          console.error('Failed to trigger renewal SMS:', smsErr);
        }

        // Renewal: Generate a new invoice automatically, preserve history, never overwrite.
        try {
          const { getSettings } = await import('./settings');
          const settings = await getSettings();

          if (settings.invoice_auto_generation) {
            const membershipFee = Number(data.membership_fee || 0);
            const parqFee = Number(data.parq_fee || 0);
            const trainerFee = Number(data.trainer_fee || 0);
            const admissionFee = Number(data.admission_fee || 0);
            const lockerFee = Number(data.locker_fee || 0);
            const dietPlanFee = Number(data.diet_plan_fee || 0);

            const subtotal = membershipFee + parqFee + trainerFee + admissionFee + lockerFee + dietPlanFee;
            
            const taxRate = 0;
            const taxAmount = 0;
            
            const grandTotal = subtotal + taxAmount;

            const invoicePayload = {
              member_id: data.id,
              amount: grandTotal,
              due_date: data.package_end_date, // Next Due Date = Membership Expiry Date
              status: 'Pending',
              notes: `Automatically generated invoice for membership renewal.`,
              membership_fee: membershipFee,
              parq_fee: parqFee,
              admission_fee: admissionFee,
              trainer_fee: trainerFee,
              locker_fee: lockerFee,
              diet_plan_fee: dietPlanFee,
              subtotal,
              discount: 0,
              tax: taxAmount,
              paid_amount: 0,
              balance_due: grandTotal,
              payment_method: null,
              transaction_id: null,
              payment_date: null,
              membership_start_date: data.package_start_date,
              membership_expiry_date: data.package_end_date,
              invoice_number: '' // Trigger will generate
            };

            await supabase.from('invoices').insert([invoicePayload]);
          }
        } catch (invErr) {
          console.error('Failed to auto-generate renewal invoice:', invErr);
        }
      }
    }

    revalidatePath('/');
    revalidatePath('/members');
    return { data: data as Member };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function deleteMember(id: string): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from('members')
    .select('full_name')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;

  await logAudit(`Deleted member: ${member?.full_name || id}`, 'Members', user.id);
  revalidatePath('/');
  revalidatePath('/members');
}

export async function uploadProfilePhoto(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    // Ensure the bucket exists by checking the list of buckets and creating it if missing
    const { data: buckets, error: listError } = await adminSupabase.storage.listBuckets();
    if (listError) {
      console.error('Failed to list buckets:', listError.message);
    }
    
    const bucketExists = buckets?.some(b => b.id === 'profile-photos');
    if (!bucketExists) {
      const { error: createError } = await adminSupabase.storage.createBucket('profile-photos', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        return { error: `Failed to create storage bucket: ${createError.message}` };
      }
    }

    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}.${ext}`;
    const { error } = await adminSupabase.storage
      .from('profile-photos')
      .upload(filename, file, { upsert: true });
    if (error) return { error: error.message };

    const { data } = adminSupabase.storage.from('profile-photos').getPublicUrl(filename);
    return { url: data.publicUrl };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function getDashboardStats() {
  try {
    await autoUpdateExpiredMembers();
  } catch (err) {
    console.error('Failed autoUpdateExpiredMembers in getDashboardStats:', err);
  }
  const supabase = await createClient();
  
  // Run queries in parallel using Promise.all
  const [
    { data: members, error: membersError },
    { data: invoices, error: invoicesError }
  ] = await Promise.all([
    supabase.from('members').select('status, package_name, package_start_date, package_end_date'),
    supabase
      .from('invoices')
      .select('amount, status, created_at')
      .eq('status', 'Paid')
  ]);

  if (membersError) throw membersError;
  if (invoicesError) throw invoicesError;

  const total = members?.length ?? 0;
  const active = members?.filter((m: { status: string }) => m.status === 'Active').length ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenue = invoices
    ?.filter((i: { created_at: string }) => new Date(i.created_at) >= monthStart)
    .reduce((sum: number, i: { amount: number | string }) => sum + Number(i.amount), 0) ?? 0;

  return { total, active, revenue };
}

export async function getMembersPaginated({
  page = 1,
  limit = 10,
  search = '',
  status = 'All',
  plan = 'All',
  machine = 'All'
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
  machine?: string;
} = {}): Promise<{ members: Member[]; totalCount: number }> {
  try {
    await autoUpdateExpiredMembers();
  } catch (err) {
    console.error('Failed autoUpdateExpiredMembers in getMembersPaginated:', err);
  }
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' });

  // Apply search filtering on name, phone, or email
  const cleanSearch = search.trim();
  if (cleanSearch) {
    query = query.or(`full_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
  }

  // Apply status filter
  if (status && status !== 'All') {
    const dObj = new Date();
    const yr = dObj.getFullYear();
    const mth = String(dObj.getMonth() + 1).padStart(2, '0');
    const dy = String(dObj.getDate()).padStart(2, '0');
    const todayStr = `${yr}-${mth}-${dy}`;

    if (status === 'Expiring in 7 Days') {
      const in7 = new Date(dObj.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in7Str = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, '0')}-${String(in7.getDate()).padStart(2, '0')}`;
      query = query.eq('status', 'Active').neq('duration', 'Daily Pass').gte('package_end_date', todayStr).lte('package_end_date', in7Str);
    } else if (status === 'Expiring in 30 Days') {
      const in30 = new Date(dObj.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in30Str = `${in30.getFullYear()}-${String(in30.getMonth() + 1).padStart(2, '0')}-${String(in30.getDate()).padStart(2, '0')}`;
      query = query.eq('status', 'Active').neq('duration', 'Daily Pass').gte('package_end_date', todayStr).lte('package_end_date', in30Str);
    } else if (status === 'Renewed This Month') {
      const monthStart = new Date(dObj.getFullYear(), dObj.getMonth(), 1).toISOString();
      const { data: renewedData } = await supabase
        .from('membership_renewals')
        .select('member_id')
        .gte('renewal_date', monthStart);
      const memberIds = (renewedData || []).map((r: { member_id: string }) => r.member_id).filter(Boolean);
      if (memberIds.length > 0) {
        query = query.in('id', memberIds);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // empty fallback
      }
    } else {
      query = query.eq('status', status);
    }
  }

  // Apply plan filter
  if (plan && plan !== 'All') {
    query = query.ilike('package_name', `%${plan}%`);
  }

  // Apply machine filter
  if (machine && machine !== 'All') {
    query = query.eq('machine_type', machine);
  }

  // Apply machine filter if provided via the `plan` param overload (legacy) or explicit machine param
  // NOTE: to keep backward compatibility, callers should pass `plan` and `machine` separately in future.

  // Sorting and pagination ranges
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching paginated members:', error);
    throw error;
  }

  return {
    members: (data || []) as Member[],
    totalCount: count || 0,
  };
}

export async function getMemberByBiometricId(biometricId: string): Promise<Member | null> {
  const supabase = await createClient();
  
  // Clean biometric ID to digits only
  const cleanId = biometricId.replace(/[^0-9]/g, '');
  if (!cleanId) return null;
  
  // Try to find by Gents machine first, then Ladies (caller should ideally pass machine)
  const { data: gentsData, error: gentsErr } = await supabase
    .from('members')
    .select('*')
    .eq('biometric_user_id', cleanId)
    .eq('machine_type', 'Gents')
    .limit(1)
    .maybeSingle();
  if (gentsErr) {
    console.error('Error in getMemberByBiometricId (Gents):', gentsErr);
  }
  if (gentsData) return gentsData as Member;

  const { data: ladiesData, error: ladiesErr } = await supabase
    .from('members')
    .select('*')
    .eq('biometric_user_id', cleanId)
    .eq('machine_type', 'Ladies')
    .limit(1)
    .maybeSingle();
  if (ladiesErr) {
    console.error('Error in getMemberByBiometricId (Ladies):', ladiesErr);
  }
  if (ladiesData) return ladiesData as Member;
    
  return null;
}

function getDurationInDays(duration: string): number {
  const durStr = duration.toLowerCase().trim();
  if (durStr === 'cardio') return 30;
  if (durStr.includes('daily')) return 1;
  if (durStr.includes('30 day') || durStr === '1 month') return 30;
  if (durStr.includes('90 day') || durStr === '3 months') return 90;
  if (durStr.includes('180 day') || durStr === '6 months') return 180;
  if (durStr.includes('365 day') || durStr.includes('1 year')) return 365;
  
  // Custom days: parse number
  const match = durStr.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 30; // fallback
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export async function queueBiometricAction(memberId: string, biometricId: string, action: 'enable' | 'disable') {
  const supabase = await createClient();

  // Find any existing pending action for this member
  const { data: existingActions, error: fetchError } = await supabase
    .from('biometric_actions')
    .select('id, action')
    .eq('member_id', memberId)
    .eq('status', 'pending');

  if (fetchError) {
    console.error('Error fetching existing biometric actions:', fetchError);
    return;
  }

  // If there's a pending action of the same type, we don't need to do anything
  const hasSameAction = existingActions?.some((a: { action: string; }) => a.action === action);
  if (hasSameAction) {
    return;
  }

  // If there's a pending action of a different type, mark it as completed/cancelled
  const differentActions = existingActions?.filter((a: { action: string; }) => a.action !== action);
  if (differentActions && differentActions.length > 0) {
    const idsToUpdate = differentActions.map((a: { id: string; }) => a.id);
    await supabase
      .from('biometric_actions')
      .update({ status: 'completed', notes: 'Superseded by new action', updated_at: new Date().toISOString() })
      .in('id', idsToUpdate);
  }

  // Now insert the new pending action
  const { error: insertError } = await supabase
    .from('biometric_actions')
    .insert({
      member_id: memberId,
      biometric_id: biometricId,
      action: action,
      status: 'pending'
    });

  if (insertError) {
    console.error('Error inserting biometric action:', insertError);
  }
}

export async function autoUpdateExpiredMembers() {
  const supabase = await createClient();

  // Get current local date string (in YYYY-MM-DD format using India/local timezone)
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // Fetch all members whose status is 'Active' and whose package_end_date has passed (excluding Daily Pass which has no expiry)
  const { data: expiredMembers, error: fetchError } = await supabase
    .from('members')
    .select('id, full_name, biometric_user_id, package_end_date, status, biometric_status, duration')
    .eq('status', 'Active')
    .neq('duration', 'Daily Pass')
    .lt('package_end_date', todayStr);

  if (fetchError) {
    console.error('Error fetching expired members for auto-update:', fetchError);
    return;
  }

  if (!expiredMembers || expiredMembers.length === 0) {
    return;
  }

  console.log(`Auto-expiring ${expiredMembers.length} members...`);

  for (const member of expiredMembers) {
    // 1. Update status to 'Expired' and biometric_status to 'DISABLED' in database
    const { error: updateError } = await supabase
      .from('members')
      .update({
        status: 'Expired',
        biometric_status: 'DISABLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', member.id);

    if (updateError) {
      console.error(`Error updating member ${member.full_name} status to Expired:`, updateError);
      continue;
    }

    // 2. Queue biometric disable action (if biometric_user_id is mapped)
    if (member.biometric_user_id) {
      await queueBiometricAction(member.id, member.biometric_user_id, 'disable');
    }
  }
}

