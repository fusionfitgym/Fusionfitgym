'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { invoiceSchema, InvoiceFormValues, INVOICE_STATUSES, MEMBERSHIP_PLANS } from '@/types';
import { createInvoice } from '@/lib/actions/invoices';
import { getMembers } from '@/lib/actions/members';
import { getSettings } from '@/lib/actions/settings';
import { Member, GymSettings } from '@/types';
import { formatCurrency } from '@/lib/utils';

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMember = searchParams.get('member');
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      member_id: preselectedMember ?? '',
      status: 'Pending',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    Promise.all([getMembers(), getSettings()]).then(([m, s]) => {
      setMembers(m);
      setSettings(s);
    });
  }, []);

  const selectedMemberId = watch('member_id');
  const selectedMember = members.find(m => m.id === selectedMemberId);

  function applyPlanPrice(plan: string) {
    if (!settings) return;
    const key = `plan_${plan.toLowerCase()}` as keyof GymSettings;
    const price = settings[key];
    if (price) setValue('amount', Number(price));
  }

  async function onSubmit(data: InvoiceFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const invoice = await createInvoice(data);
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter max-w-2xl mx-auto">
      <PageHeader
        title="Create Invoice"
        subtitle="Generate a new membership invoice"
        action={
          <Link href="/invoices" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Member */}
        <Card>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Member <span className="text-red-500">*</span>
          </label>
          <select {...register('member_id')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="">Select a member...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>)}
          </select>
          {errors.member_id && <p className="text-xs text-red-500 mt-1">{errors.member_id.message}</p>}

          {/* Quick plan price buttons */}
          {selectedMember && settings && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-2">Quick fill by plan:</p>
              <div className="flex gap-2 flex-wrap">
                {MEMBERSHIP_PLANS.map(plan => {
                  const key = `plan_${plan.toLowerCase()}` as keyof GymSettings;
                  return (
                    <button
                      type="button"
                      key={plan}
                      onClick={() => applyPlanPrice(plan)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
                    >
                      {plan} — {formatCurrency(Number(settings[key]))}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Invoice Details */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
              <input
                {...register('amount')}
                type="number"
                step="0.01"
                placeholder="1500"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Due Date <span className="text-red-500">*</span></label>
              <input
                {...register('due_date')}
                type="date"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Status <span className="text-red-500">*</span></label>
              <select {...register('status')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input
                {...register('notes')}
                type="text"
                placeholder="Optional note..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
            </div>
          </div>
        </Card>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-yellow">
            {submitting ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Creating...' : 'Create Invoice'}
          </button>
          <Link href="/invoices" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}
