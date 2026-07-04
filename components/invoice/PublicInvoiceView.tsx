'use client';

import { useState } from 'react';
import { Download, Loader2, Printer } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PublicInvoiceData } from '@/lib/actions/public-invoice';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function PublicInvoiceView({ invoice, settings }: PublicInvoiceData) {
  const [downloading, setDownloading] = useState(false);
  const member = invoice.member;

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/pdf/generateInvoice');
      await generateInvoicePDF(invoice, {
        gym_name: settings.gym_name,
        gym_phone: settings.gym_phone,
        gym_email: settings.gym_email,
        gym_address: settings.gym_address,
        gym_logo: settings.gym_logo,
        plan_monthly: '0',
        plan_quarterly: '0',
        plan_biannual: '0',
        plan_annual: '0',
        sms_provider_name: '',
        sms_api_url: '',
        sms_api_key: '',
        sms_sender_id: '',
        sms_enabled: false,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 print:bg-white">
      <div className="mx-auto max-w-lg px-4 py-6 sm:py-10 print:max-w-none print:p-0">
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl print:rounded-none print:border-0 print:shadow-none">
          {/* Header */}
          <header className="bg-[#0b0d12] px-5 py-6 text-white sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {settings.gym_logo && (
                  <img
                    src={settings.gym_logo}
                    alt={settings.gym_name}
                    className="h-12 w-12 rounded-xl border border-white/10 bg-white object-contain p-1"
                  />
                )}
                <div>
                  <h1 className="text-lg font-bold tracking-tight text-amber-300">{settings.gym_name}</h1>
                  {settings.gym_address && (
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{settings.gym_address}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Invoice</p>
                <p className="mt-1 font-mono text-sm font-bold">{invoice.invoice_number}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <StatusBadge variant={invoice.status} />
              <p className="text-xs text-zinc-400">{formatDate(invoice.created_at)}</p>
            </div>
          </header>

          {/* Body */}
          <div className="space-y-5 p-5 sm:p-6">
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bill to</p>
              <p className="mt-1 text-base font-bold text-slate-900">{member?.full_name ?? 'Member'}</p>
              {member?.phone && <p className="text-sm text-slate-600">{member.phone}</p>}
              {member?.email && <p className="text-sm text-slate-600 break-all">{member.email}</p>}
            </section>

            <section className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 p-4 text-xs border border-slate-100">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Plan</p>
                <p className="mt-0.5 font-bold text-slate-800">{member?.package_name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Plan Duration</p>
                <p className="mt-0.5 font-semibold text-slate-800">{member?.package_duration ?? '—'}</p>
              </div>
              <div className="border-t border-slate-200/50 pt-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Start Date</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatDate(invoice.membership_start_date || member?.package_start_date)}</p>
              </div>
              <div className="border-t border-slate-200/50 pt-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Expiry Date</p>
                <p className="mt-0.5 font-semibold text-slate-800">{formatDate(invoice.membership_expiry_date || member?.package_end_date)}</p>
              </div>
              <div className="border-t border-slate-200/50 pt-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Payment Date</p>
                <p className="mt-0.5 font-semibold text-slate-800">{invoice.payment_date ? formatDate(invoice.payment_date) : '—'}</p>
              </div>
              <div className="border-t border-slate-200/50 pt-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Next Due Date</p>
                <p className="mt-0.5 font-bold text-amber-700">{formatDate(invoice.due_date)}</p>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200">
              <div className="bg-slate-950 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
                Invoice details
              </div>
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-600">
                  Membership — {member?.package_name ?? 'Package'} ({member?.package_duration ?? '—'})
                </span>
                <span className="font-semibold text-slate-900">{formatCurrency(invoice.membership_fee || invoice.amount)}</span>
              </div>
              {invoice.parq_fee && invoice.parq_fee > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="text-slate-600">PAR-Q Fee</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(invoice.parq_fee)}</span>
                </div>
              ) : null}
              {invoice.trainer_fee && invoice.trainer_fee > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="text-slate-600">Trainer Fee</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(invoice.trainer_fee)}</span>
                </div>
              ) : null}
              {invoice.admission_fee && invoice.admission_fee > 0 ? (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="text-slate-600">Admission Fee</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(invoice.admission_fee)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-amber-300 bg-amber-300 px-4 py-3">
                <span className="text-sm font-bold text-zinc-950">Total due</span>
                <span className="text-lg font-extrabold text-zinc-950">{formatCurrency(invoice.amount)}</span>
              </div>
            </section>

            {invoice.notes && (
              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-bold uppercase text-slate-400">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{invoice.notes}</p>
              </section>
            )}

            {(settings.gym_phone || settings.gym_email) && (
              <p className="text-center text-xs text-slate-500">
                Questions? {[settings.gym_phone, settings.gym_email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Actions */}
          <footer className="flex flex-col gap-2 border-t border-slate-100 p-4 sm:flex-row print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-secondary flex-1 justify-center"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Invoice
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPDF()}
              disabled={downloading}
              className="btn btn-primary flex-1 justify-center"
            >
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Download PDF
            </button>
          </footer>
        </article>

        <p className="mt-4 text-center text-[10px] text-slate-400 print:hidden">
          Secure invoice link · {settings.gym_name}
        </p>
      </div>
    </div>
  );
}
