'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText, Loader2, ReceiptText, Save, UserRound } from 'lucide-react';
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
  MEMBERSHIP_PLANS,
} from '@/types';
import { formatCurrency } from '@/lib/utils';
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
      status: 'Pending',
      due_date: defaultDueDate,
      notes: '',
    },
  });

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

  const selectedMemberId = useWatch({ control, name: 'member_id' });
  const selectedMember = members.find((member) => member.id === selectedMemberId);

  function applyPlanPrice(plan: string) {
    if (!settings) return;
    const key = `plan_${plan.toLowerCase()}` as keyof GymSettings;
    setValue('amount', Number(settings[key]), { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(data: InvoiceFormValues) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
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
        subtitle="Generate a membership charge and set its due date and payment status."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        <SectionCard
          title="Member"
          description="Choose the member who will receive this invoice."
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
                <option key={member.id} value={member.id}>{member.full_name} - {member.phone}</option>
              ))}
            </select>
          </FormField>

          {selectedMember && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500">Quick fill by member's package</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setValue('amount', selectedMember.package_price, { shouldDirty: true, shouldValidate: true })}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition-colors hover:bg-amber-100"
                >
                  <span className="block text-xs font-bold text-amber-900">{selectedMember.package_name}</span>
                  <span className="mt-1 block text-[11px] text-amber-700">
                    Price: {formatCurrency(selectedMember.package_price)} | Duration: {selectedMember.package_duration}
                  </span>
                </button>
                {settings && (
                  <button
                    type="button"
                    onClick={() => {
                      // Try to match standard plan price from settings if needed
                      const fallbackKey = `plan_monthly` as keyof GymSettings;
                      setValue('amount', Number(settings[fallbackKey]), { shouldDirty: true, shouldValidate: true });
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100"
                  >
                    <span className="block text-xs font-semibold text-slate-800">Standard Monthly Rate</span>
                    <span className="mt-1 block text-[11px] text-slate-600">{formatCurrency(Number(settings.plan_monthly))}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </SectionCard>

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
                placeholder="1500"
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
                {INVOICE_STATUSES.map((status) => <option key={status}>{status}</option>)}
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

        {error && <FormError>{error}</FormError>}

        <FormActions sticky>
          <Link href="/invoices" className="btn btn-secondary w-full sm:w-auto">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Creating...' : 'Create invoice'}
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
