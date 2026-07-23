'use client';

import { useState, useMemo } from 'react';
import { Download, Loader2, Printer, QrCode, ExternalLink, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PublicInvoiceData } from '@/lib/actions/public-invoice';
import { formatCurrency, formatDate } from '@/lib/utils';
import { generateQRCodeDataUrl } from '@/lib/qr';
import { buildInvoicePublicUrl } from '@/lib/invoice-links';

export default function PublicInvoiceView({ invoice, settings }: PublicInvoiceData) {
  const [downloading, setDownloading] = useState(false);
  const member = invoice.member;

  const publicUrl = useMemo(() => {
    return buildInvoicePublicUrl(invoice.invoice_token || invoice.id);
  }, [invoice]);

  const qrDataUrl = useMemo(() => {
    return generateQRCodeDataUrl(publicUrl, { size: 160, margin: 2 });
  }, [publicUrl]);

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 p-4 sm:p-8 print:bg-white print:p-0 print:text-black">
      <div className="mx-auto max-w-xl print:max-w-none print:p-0">
        <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md print:rounded-none print:border-0 print:bg-white print:shadow-none">
          {/* Header Block */}
          <header className="bg-gradient-to-r from-slate-950 via-zinc-900 to-slate-950 p-6 text-white sm:p-8 border-b border-amber-500/20">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {settings.gym_logo ? (
                  <img
                    src={settings.gym_logo}
                    alt={settings.gym_name}
                    className="h-14 w-14 rounded-2xl border border-amber-500/30 bg-white object-contain p-1.5 shadow-lg shadow-amber-500/10"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-2xl border border-amber-500/40 bg-amber-400/10 flex items-center justify-center text-amber-400 font-extrabold text-2xl">
                    💪
                  </div>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-300">
                    {settings.gym_name}
                  </h1>
                  {settings.gym_address && (
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-xs">{settings.gym_address}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {[settings.gym_phone, settings.gym_email].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <div className="sm:text-right flex flex-col items-start sm:items-end justify-between self-stretch sm:self-auto">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    INVOICE NO
                  </span>
                  <span className="font-mono text-base sm:text-lg font-bold text-white tracking-wide">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="mt-2">
                  <StatusBadge variant={invoice.status} />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" /> Verified FusionFit Online Invoice
              </div>
              <div>Issue Date: {formatDate(invoice.created_at)}</div>
            </div>
          </header>

          {/* Body Section */}
          <div className="space-y-6 p-6 sm:p-8 print:p-6 print:text-black">
            {/* Bill To & Package Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Member Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-1.5 print:border-slate-300 print:bg-slate-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Billed To</p>
                <p className="text-base font-extrabold text-white print:text-black">
                  {member?.full_name ?? 'Member'}
                </p>
                {member?.phone && <p className="text-xs text-slate-400 print:text-slate-700">Phone: {member.phone}</p>}
                {member?.email && <p className="text-xs text-slate-400 print:text-slate-700 break-all">Email: {member.email}</p>}
                {member?.address && <p className="text-xs text-slate-400 print:text-slate-700">Address: {member.address}</p>}
              </div>

              {/* Invoice Summary Card */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2 print:border-slate-300 print:bg-slate-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Membership Summary</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Package:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{member?.package_name ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{member?.package_duration ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Start Date:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{formatDate(invoice.membership_start_date || member?.package_start_date)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Expiry Date:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{formatDate(invoice.membership_expiry_date || member?.package_end_date)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Items Breakdown */}
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 print:border-slate-300 print:bg-white">
              <div className="bg-slate-800/60 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 border-b border-slate-800 print:bg-slate-100 print:text-black">
                Itemized Breakdown
              </div>
              <div className="divide-y divide-slate-800/60 text-xs sm:text-sm print:divide-slate-200">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-slate-300 print:text-slate-800">
                    Membership Fee ({member?.package_name || 'Gym Package'})
                  </span>
                  <span className="font-semibold text-slate-100 print:text-black">
                    {formatCurrency(invoice.membership_fee || invoice.amount)}
                  </span>
                </div>
                {invoice.parq_fee && invoice.parq_fee > 0 ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-slate-300 print:text-slate-800">PAR-Q Assessment Fee</span>
                    <span className="font-semibold text-slate-100 print:text-black">{formatCurrency(invoice.parq_fee)}</span>
                  </div>
                ) : null}
                {invoice.trainer_fee && invoice.trainer_fee > 0 ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-slate-300 print:text-slate-800">
                      Personal Training Fee {invoice.trainer_name ? `(${invoice.trainer_name})` : ''}
                    </span>
                    <span className="font-semibold text-slate-100 print:text-black">{formatCurrency(invoice.trainer_fee)}</span>
                  </div>
                ) : null}
                {invoice.admission_fee && invoice.admission_fee > 0 ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-slate-300 print:text-slate-800">Admission Fee</span>
                    <span className="font-semibold text-slate-100 print:text-black">{formatCurrency(invoice.admission_fee)}</span>
                  </div>
                ) : null}
                {invoice.locker_fee && invoice.locker_fee > 0 ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-slate-300 print:text-slate-800">Locker Fee</span>
                    <span className="font-semibold text-slate-100 print:text-black">{formatCurrency(invoice.locker_fee)}</span>
                  </div>
                ) : null}
                {invoice.diet_plan_fee && invoice.diet_plan_fee > 0 ? (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-slate-300 print:text-slate-800">Diet Plan Fee</span>
                    <span className="font-semibold text-slate-100 print:text-black">{formatCurrency(invoice.diet_plan_fee)}</span>
                  </div>
                ) : null}

                {/* Subtotal & Totals */}
                <div className="bg-slate-900/40 p-4 space-y-2 text-xs border-t border-slate-800 print:bg-slate-50">
                  <div className="flex justify-between text-slate-400 print:text-slate-600">
                    <span>Payment Method:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{invoice.payment_method || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 print:text-slate-600">
                    <span>Payment Date:</span>
                    <span className="font-semibold text-slate-200 print:text-black">{invoice.payment_date ? formatDate(invoice.payment_date) : '—'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 print:text-slate-600">
                    <span>Next Due Date:</span>
                    <span className="font-semibold text-amber-400 print:text-black">{formatDate(invoice.due_date)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-amber-400/10 border-t border-amber-500/30 px-4 py-4 text-base font-bold print:bg-amber-100 print:text-black">
                  <span className="text-amber-300 print:text-black">Total Paid Amount</span>
                  <span className="text-xl font-extrabold text-amber-400 print:text-black">{formatCurrency(invoice.amount)}</span>
                </div>
              </div>
            </div>

            {/* QR Code Verification Section */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-slate-950 to-slate-950 p-4 flex items-center justify-between gap-4 print:border-slate-300 print:bg-white">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <QrCode className="w-4 h-4" /> Scan QR to Verify Invoice
                </div>
                <p className="text-[11px] text-slate-400 print:text-slate-600">
                  Scan this QR code with any smartphone camera to open and verify this digital invoice online.
                </p>
              </div>
              <div className="shrink-0 bg-white p-2 rounded-xl border border-slate-200 shadow-md">
                <img src={qrDataUrl} alt="Invoice QR Code" className="w-20 h-20 object-contain" />
              </div>
            </div>

            {invoice.notes && (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                <p className="font-bold text-amber-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="leading-relaxed">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer & Action Buttons */}
          <footer className="bg-slate-950 p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center justify-center gap-2 transition-all border border-slate-700"
            >
              <Printer className="w-4 h-4 text-slate-400" /> Print Invoice
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadPDF()}
              disabled={downloading}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download PDF
            </button>
          </footer>
        </article>

        <p className="mt-4 text-center text-xs text-slate-500 print:hidden">
          Official FusionFit ERP Digital Invoice · Secure & Encrypted Token Access
        </p>
      </div>
    </div>
  );
}
