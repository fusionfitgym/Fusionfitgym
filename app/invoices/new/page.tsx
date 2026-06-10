'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/Primitives';
import { invoiceSchema, InvoiceFormValues, InvoiceFormInput, INVOICE_STATUSES, MEMBERSHIP_PLANS } from '@/types';
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

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<InvoiceFormInput, any, InvoiceFormValues>({
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto"
    >
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center text-sm text-slate-400 gap-1.5 font-medium">
        <Link href="/invoices" className="hover:text-slate-600 transition-colors">Invoices</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900">Create Invoice</span>
      </div>

      <PageHeader
        title="Create Invoice"
        subtitle="Generate a new membership invoice"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Member Selection */}
        <div className="card p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-section-title text-lg">Select Member</h3>
            <p className="text-sm text-slate-400 mt-1">Choose the member for this invoice</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <label className="text-label block mb-2">Member <span className="text-red-500">*</span></label>
            <select {...register('member_id')} className="select-field">
              <option value="">Select a member...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>)}
            </select>
            {errors.member_id && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.member_id.message}</p>}

            {selectedMember && settings && (
              <div className="mt-4 pt-4 border-t border-slate-50">
                <p className="text-xs text-slate-400 mb-2 font-medium">Quick fill by plan:</p>
                <div className="flex gap-2 flex-wrap">
                  {MEMBERSHIP_PLANS.map(plan => {
                    const key = `plan_${plan.toLowerCase()}` as keyof GymSettings;
                    return (
                      <button
                        type="button"
                        key={plan}
                        onClick={() => applyPlanPrice(plan)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        {plan} — {formatCurrency(Number(settings[key]))}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="card p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-section-title text-lg">Invoice Details</h3>
            <p className="text-sm text-slate-400 mt-1">Amount, due date, and status</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-label block mb-2">Amount (₹) <span className="text-red-500">*</span></label>
                <input {...register('amount')} type="number" step="0.01" placeholder="1500" className="input-field" />
                {errors.amount && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.amount.message}</p>}
              </div>
              <div>
                <label className="text-label block mb-2">Due Date <span className="text-red-500">*</span></label>
                <input {...register('due_date')} type="date" className="input-field" />
                {errors.due_date && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.due_date.message}</p>}
              </div>
              <div>
                <label className="text-label block mb-2">Status <span className="text-red-500">*</span></label>
                <select {...register('status')} className="select-field">
                  {INVOICE_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-label block mb-2">Notes</label>
                <input {...register('notes')} type="text" placeholder="Optional note..." className="input-field" />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 mb-6 font-medium">{error}</div>}

        {/* Sticky Footer */}
        <div className="sticky bottom-0 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-lg border-t border-slate-200 z-10">
          <div className="flex flex-col sm:flex-row gap-3 justify-end max-w-3xl mx-auto">
            <Link href="/invoices" className="btn-outline w-full sm:w-auto">Cancel</Link>
            <button type="submit" disabled={submitting} className="btn-gold-gradient w-full sm:w-auto">
              {submitting ? <Loader2 className="w-5 h-5 spin" /> : <Save className="w-5 h-5" />}
              {submitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading...</div>}>
      <NewInvoiceForm />
    </Suspense>
  );
}
