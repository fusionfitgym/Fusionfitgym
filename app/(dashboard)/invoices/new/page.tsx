'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  FileText,
  Loader2,
  ReceiptText,
  Save,
  Sparkles,
  Ticket,
  UserCheck,
  UserPlus,
  UserRound,
  Zap,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Breadcrumb,
  FormActions,
  FormError,
  FormField,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { createInvoice } from '@/lib/actions/invoices';
import { getMembers } from '@/lib/actions/members';
import { getSettings } from '@/lib/actions/settings';
import {
  GymSettings,
  INVOICE_STATUSES,
  InvoiceFormInput,
  InvoiceFormValues,
  invoiceSchema,
  Member,
} from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

const defaultDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const preselectedMember = searchParams.get('member');

  // Mode state: 'daily' = AI Walk-in Guest Pass, 'member' = Registered Member Charge
  const [invoiceMode, setInvoiceMode] = useState<'daily' | 'member'>('daily');
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<InvoiceFormInput, unknown, InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      member_id: preselectedMember ?? '',
      guest_name: '',
      guest_phone: '',
      status: 'Paid',
      due_date: new Date().toISOString().split('T')[0],
      amount: 50,
      notes: 'Daily Client Pass (₹50.00)',
    },
  });

  const dailyRate = settings?.plan_daily ? Number(settings.plan_daily) : 50;

  useEffect(() => {
    if (isDemo) {
      setMembers(demo.members);
      setSettings(demo.settings);
      return;
    }
    Promise.all([getMembers(), getSettings()]).then(([memberData, settingsData]) => {
      setMembers(memberData);
      setSettings(settingsData);
    });
  }, [isDemo, demo.members, demo.settings]);

  // If a member was preselected in URL query, switch mode to 'member'
  useEffect(() => {
    if (preselectedMember) {
      setInvoiceMode('member');
      setValue('member_id', preselectedMember);
      setValue('status', 'Pending');
      setValue('due_date', defaultDueDate);
    }
  }, [preselectedMember, setValue]);

  const selectedMemberId = useWatch({ control, name: 'member_id' });
  const watchedAmount = useWatch({ control, name: 'amount' });
  const watchedStatus = useWatch({ control, name: 'status' });
  const watchedGuestName = useWatch({ control, name: 'guest_name' });
  const selectedMember = members.find((m) => m.id === selectedMemberId);

  useEffect(() => {
    if (invoiceMode === 'member' && selectedMember) {
      const pkg = (selectedMember.package_name || '').toLowerCase();
      const dur = (selectedMember.package_duration || '').toLowerCase();
      
      if (pkg.includes('daily') || dur.includes('daily')) {
        setValue('amount', dailyRate, { shouldDirty: true, shouldValidate: true });
        setValue('notes', `Daily Client Pass (${formatCurrency(dailyRate)})`, { shouldDirty: true, shouldValidate: true });
      } else if (selectedMember.package_price) {
        setValue('amount', selectedMember.package_price, { shouldDirty: true, shouldValidate: true });
        setValue('notes', `Membership Fee - ${selectedMember.package_name || 'Standard Package'}`, { shouldDirty: true, shouldValidate: true });
      }
    }
  }, [invoiceMode, selectedMemberId, selectedMember, dailyRate, setValue]);

  // Switch modes dynamically
  function switchMode(mode: 'daily' | 'member') {
    setInvoiceMode(mode);
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (mode === 'daily') {
      setValue('member_id', '', { shouldValidate: true });
      setValue('amount', dailyRate, { shouldDirty: true, shouldValidate: true });
      setValue('due_date', todayStr, { shouldDirty: true, shouldValidate: true });
      setValue('status', 'Paid', { shouldDirty: true, shouldValidate: true });
      setValue('notes', `Daily Client Pass (${formatCurrency(dailyRate)})`, { shouldDirty: true, shouldValidate: true });
      toast.success(`AI Daily Pass mode enabled! Member selection is not required.`);
    } else {
      setValue('due_date', defaultDueDate, { shouldDirty: true, shouldValidate: true });
      setValue('status', 'Pending', { shouldDirty: true, shouldValidate: true });
    }
  }

  function applyDailyClientRate() {
    const todayStr = new Date().toISOString().split('T')[0];
    setValue('amount', dailyRate, { shouldDirty: true, shouldValidate: true });
    setValue('due_date', todayStr, { shouldDirty: true, shouldValidate: true });
    setValue('notes', `Daily Client Pass (${formatCurrency(dailyRate)})`, { shouldDirty: true, shouldValidate: true });
    toast.info(`Daily Client rate (${formatCurrency(dailyRate)}) applied!`);
  }

  async function onSubmit(data: InvoiceFormValues) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // If Daily pass mode, default notes and guest details
    if (invoiceMode === 'daily') {
      if (!data.notes) {
        data.notes = `Daily Client Pass (${formatCurrency(data.amount || dailyRate)})`;
      }
    }

    if (isDemo) {
      setTimeout(() => {
        const created = demo.createInvoice(data);
        toast.success('Invoice created successfully (Demo Mode)');
        reset();
        router.push(`/invoices/${created.id}`);
      }, 400);
      return;
    }

    try {
      const res = await createInvoice(data);
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        setSubmitting(false);
        return;
      }
      if (res.data) {
        toast.success(`Invoice ${res.data.invoice_number} created successfully!`);
        reset();
        router.push(`/invoices/${res.data.id}`);
      }
    } catch (caughtError: any) {
      console.error('Unhandled submit exception:', caughtError);
      const msg = caughtError?.message || 'Failed to create invoice.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow page-enter">
      <Breadcrumb
        items={[
          { label: 'Invoices', href: '/invoices' },
          { label: 'Create invoice' },
        ]}
      />

      <PageHeader
        title="Create invoice"
        subtitle="Issue an instant Walk-in Daily Pass or charge a registered member."
      />

      {/* Modern AI Mode Selector Segment */}
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm sm:p-2">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchMode('daily')}
            className={cn(
              'relative flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-xs font-bold transition-all duration-200',
              invoiceMode === 'daily'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <Zap className={cn('h-4 w-4', invoiceMode === 'daily' ? 'text-amber-300' : 'text-emerald-600')} />
            <span>⚡ AI Daily Pass (Walk-in Guest)</span>
            {invoiceMode === 'daily' && (
              <span className="ml-1 inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white">
                No Member Needed
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => switchMode('member')}
            className={cn(
              'relative flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-xs font-bold transition-all duration-200',
              invoiceMode === 'member'
                ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md shadow-slate-900/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <UserCheck className={cn('h-4 w-4', invoiceMode === 'member' ? 'text-cyan-400' : 'text-slate-500')} />
            <span>👤 Registered Member Charge</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        {/* AI Daily Pass Header Banner / Card */}
        {invoiceMode === 'daily' ? (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">AI Daily Pass Fast-Track</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                      <Zap className="h-3 w-3 text-emerald-600" /> ✨ AI Auto-Configured
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Ideal for 1-day guest visits or walk-in clients. <strong>Member selection is not required</strong>.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200/80 bg-white/80 px-3 py-2 backdrop-blur-sm">
                <Ticket className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Rate</p>
                  <p className="text-sm font-extrabold text-emerald-950">{formatCurrency(dailyRate)} / day</p>
                </div>
              </div>
            </div>

            {/* Optional Guest Details */}
            <div className="mt-4 grid grid-cols-1 gap-3 pt-3 border-t border-emerald-200/60 sm:grid-cols-2">
              <div>
                <label htmlFor="guest_name" className="block text-xs font-bold text-slate-700 mb-1">
                  Guest / Client Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="input-with-icon">
                  <UserPlus className="h-4 w-4 text-emerald-600" />
                  <input
                    id="guest_name"
                    type="text"
                    placeholder="Walk-in Guest (e.g. Rahul Sharma)"
                    className="input-field border-emerald-200 focus:border-emerald-500"
                    {...register('guest_name')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guest_phone" className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="guest_phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  className="input-field border-emerald-200 focus:border-emerald-500"
                  {...register('guest_phone')}
                />
              </div>
            </div>
          </div>
        ) : (
          <SectionCard
            title="Member & Quick Presets"
            description="Choose the member and select quick pricing presets (e.g. Daily Client ₹50)."
            icon={<UserRound className="h-5 w-5" />}
          >
            <FormField
              label="Member"
              htmlFor="member_id"
              required
              error={errors.member_id?.message}
            >
              <select
                id="member_id"
                className="select-field"
                aria-invalid={Boolean(errors.member_id)}
                {...register('member_id')}
              >
                <option value="">Select a member</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} - {member.phone}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Preset Buttons Grid */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Fill Presets</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={applyDailyClientRate}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 p-3 text-left transition-all shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-bold text-emerald-950">Daily Client Pass</span>
                    <span className="inline-flex items-center rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ⚡ {formatCurrency(dailyRate)}
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-emerald-800 font-medium">
                    Set amount to {formatCurrency(dailyRate)} (1-Day visit)
                  </span>
                </button>

                {selectedMember && (
                  <button
                    type="button"
                    onClick={() =>
                      setValue('amount', selectedMember.package_price, { shouldDirty: true, shouldValidate: true })
                    }
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition-colors hover:bg-amber-100"
                  >
                    <span className="block text-xs font-bold text-amber-900 line-clamp-1">
                      {selectedMember.package_name}
                    </span>
                    <span className="mt-1 block text-[11px] text-amber-700">
                      Price: {formatCurrency(selectedMember.package_price)} | {selectedMember.package_duration}
                    </span>
                  </button>
                )}

                {settings && (
                  <button
                    type="button"
                    onClick={() => {
                      const fallbackKey = `plan_monthly` as keyof GymSettings;
                      setValue('amount', Number(settings[fallbackKey]), { shouldDirty: true, shouldValidate: true });
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                  >
                    <span className="block text-xs font-semibold text-slate-800">Standard Monthly Rate</span>
                    <span className="mt-1 block text-[11px] text-slate-600">
                      {formatCurrency(Number(settings.plan_monthly))}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Invoice details"
          description="Set the charge amount, due date, and current status."
          icon={<ReceiptText className="h-5 w-5" />}
        >
          <div className="field-grid field-grid-2">
            <FormField
              label="Amount (INR)"
              htmlFor="amount"
              required
              error={errors.amount?.message}
            >
              <input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="50"
                className="input-field"
                aria-invalid={Boolean(errors.amount)}
                {...register('amount')}
              />
            </FormField>

            <FormField
              label="Due date"
              htmlFor="due_date"
              required
              error={errors.due_date?.message}
            >
              <input
                id="due_date"
                type="date"
                className="input-field"
                aria-invalid={Boolean(errors.due_date)}
                {...register('due_date')}
              />
            </FormField>

            <FormField label="Status" htmlFor="status" required>
              <select id="status" className="select-field" {...register('status')}>
                {INVOICE_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Reference note" htmlFor="notes">
              <div className="input-with-icon">
                <FileText />
                <input
                  id="notes"
                  type="text"
                  placeholder="Optional note"
                  className="input-field"
                  {...register('notes')}
                />
              </div>
            </FormField>
          </div>

          {/* Live AI Ticket Preview Box for Daily Pass */}
          {invoiceMode === 'daily' && (
            <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3.5 text-xs text-slate-700">
              <div className="flex items-center justify-between font-bold text-emerald-950 mb-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Daily Pass Ticket Preview
                </span>
                <span className="text-emerald-700 font-mono font-semibold">{formatCurrency(Number(watchedAmount) || dailyRate)}</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Issued for: <strong className="text-slate-900">{watchedGuestName ? watchedGuestName : 'Walk-in Guest'}</strong> • Valid: 1 Day • Status: <span className="font-semibold text-emerald-700">{watchedStatus || 'Paid'}</span>
              </p>
            </div>
          )}
        </SectionCard>

        {error && <FormError>{error}</FormError>}

        <FormActions sticky>
          <Link href="/invoices" className="btn btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'btn w-full sm:w-auto font-bold transition-all shadow-md',
              invoiceMode === 'daily'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'btn-primary'
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Creating...' : invoiceMode === 'daily' ? '⚡ Issue Daily Pass' : 'Create invoice'}
          </button>
        </FormActions>
      </form>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewInvoiceForm />
    </Suspense>
  );
}
