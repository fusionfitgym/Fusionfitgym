'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Loader2,
  ReceiptText,
  Save,
  Ticket,
  UserCheck,
  UserPlus,
  UserRound,
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

  // Mode state: 'daily' = Walk-in Guest Pass, 'member' = Registered Member Charge
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

    // If Daily pass mode, default notes if empty
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

      {/* Premium Mode Selector Tabs */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-100/70 p-1">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => switchMode('daily')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-semibold transition-all duration-150',
              invoiceMode === 'daily'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            )}
          >
            <Ticket className={cn('h-4 w-4', invoiceMode === 'daily' ? 'text-slate-900' : 'text-slate-500')} />
            <span>Walk-in Daily Pass</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode('member')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2.5 px-4 text-xs font-semibold transition-all duration-150',
              invoiceMode === 'member'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            )}
          >
            <UserCheck className={cn('h-4 w-4', invoiceMode === 'member' ? 'text-slate-900' : 'text-slate-500')} />
            <span>Registered Member Charge</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        {/* Single Section Form for Daily Pass Mode */}
        {invoiceMode === 'daily' ? (
          <SectionCard
            title="Daily Pass Details"
            description="Issue a single-day pass for walk-in guests."
            icon={<Ticket className="h-5 w-5 text-slate-700" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="guest_name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Member / Guest Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="input-with-icon">
                  <UserPlus className="h-4 w-4 text-slate-400" />
                  <input
                    id="guest_name"
                    type="text"
                    placeholder="Walk-in Guest (e.g. Rahul Sharma)"
                    className="input-field"
                    {...register('guest_name')}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="guest_phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  id="guest_phone"
                  type="tel"
                  placeholder="+91 9876543210"
                  className="input-field"
                  {...register('guest_phone')}
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  className="input-field font-medium text-slate-900"
                  aria-invalid={Boolean(errors.amount)}
                  {...register('amount')}
                />
              </FormField>

              <FormField
                label="Due Date"
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

              <FormField label="Reference Note" htmlFor="notes">
                <div className="input-with-icon">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <input
                    id="notes"
                    type="text"
                    placeholder="Optional reference note"
                    className="input-field"
                    {...register('notes')}
                  />
                </div>
              </FormField>
            </div>
          </SectionCard>
        ) : (
          <>
            <SectionCard
              title="Member & Quick Presets"
              description="Choose the member and select quick pricing presets."
              icon={<UserRound className="h-5 w-5 text-slate-700" />}
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
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Quick Fill Presets
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={applyDailyClientRate}
                    className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 p-3 text-left transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="block text-xs font-bold text-slate-900">Daily Client Pass</span>
                      <span className="inline-flex items-center rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {formatCurrency(dailyRate)}
                      </span>
                    </div>
                    <span className="mt-1 block text-[11px] text-slate-600 font-medium">
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

            <SectionCard
              title="Invoice details"
              description="Set the charge amount, due date, and current status."
              icon={<ReceiptText className="h-5 w-5 text-slate-700" />}
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
            </SectionCard>
          </>
        )}

        {error && <FormError>{error}</FormError>}

        <FormActions sticky>
          <Link href="/invoices" className="btn btn-secondary w-full sm:w-auto">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full sm:w-auto font-semibold"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Creating...' : invoiceMode === 'daily' ? 'Issue Daily Pass' : 'Create Invoice'}
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

