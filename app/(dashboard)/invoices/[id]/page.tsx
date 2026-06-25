'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  Breadcrumb,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SmsSendButton } from '@/components/ui/SmsSendButton';
import { getInvoiceById, updateInvoiceStatus, ensureInvoiceToken } from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { GymSettings, Invoice, INVOICE_STATUSES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { buildInvoiceMessage } from '@/lib/native-sms';
import { buildInvoicePublicUrl } from '@/lib/invoice-links';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [invoiceLink, setInvoiceLink] = useState('');

  useEffect(() => {
    Promise.all([getInvoiceById(id), getSettings()])
      .then(async ([invoiceData, settingsData]) => {
        setInvoice(invoiceData);
        setSettings(settingsData);
        if (invoiceData) {
          const token = invoiceData.invoice_token || (await ensureInvoiceToken(invoiceData.id));
          setInvoiceLink(buildInvoicePublicUrl(token));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: Invoice['status']) {
    if (!invoice) return;
    setUpdating(true);
    try {
      await updateInvoiceStatus(id, status);
      setInvoice((current) => current ? { ...current, status } : null);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDownloadPDF() {
    if (!invoice || !settings) return;
    setDownloading(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/pdf/generateInvoice');
      await generateInvoicePDF(invoice, settings);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF: ' + (err?.message || String(err)));
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!invoice) return <div className="empty-state"><p className="card-title">Invoice not found</p></div>;

  const member = invoice.member as {
    full_name: string;
    phone?: string;
    email?: string;
    address?: string;
    package_name?: string;
    package_duration?: string;
    package_price?: number;
    package_start_date?: string;
    package_end_date?: string;
  } | undefined;

  const statusIcons = {
    Paid: CheckCircle,
    Pending: Clock,
    Overdue: AlertCircle,
  };

  return (
    <div className="page-medium page-enter">
      <Breadcrumb
        items={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
      />
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`Created ${formatDate(invoice.created_at)}`}
        action={
          <>
            <Link href="/invoices" className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            <SmsSendButton
              phone={member?.phone}
              message={buildInvoiceMessage(
                member?.full_name ?? 'Member',
                invoice.invoice_number,
                formatCurrency(invoice.amount),
                invoiceLink,
              )}
              variant="sms"
              label="Send Invoice SMS"
            />
            {invoiceLink && (
              <button
                type="button"
                onClick={() => window.open(invoiceLink, '_blank')}
                className="btn btn-ghost"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Preview Invoice
              </button>
            )}
            {invoiceLink && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(invoiceLink);
                  alert('Invoice link copied to clipboard');
                }}
                className="btn btn-secondary"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Invoice Link
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="btn btn-primary"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </button>
          </>
        }
      />

      <div className="page-stack">
        <section className="card overflow-hidden">
          <div className="bg-[#0b0d12] p-5 text-white sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-amber-300">{settings?.gym_name ?? 'FusionFit Gym'}</h2>
                {settings?.gym_address && <p className="mt-2 text-xs text-zinc-400">{settings.gym_address}</p>}
                <p className="mt-1 text-xs text-zinc-400">
                  {[settings?.gym_phone, settings?.gym_email].filter(Boolean).join(' | ')}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Invoice</p>
                <p className="mt-1 font-mono text-sm font-bold text-white">{invoice.invoice_number}</p>
                <div className="mt-3"><StatusBadge variant={invoice.status} /></div>
                {invoiceLink && (
                  <div className="mt-3 space-y-1 rounded-xl bg-white/10 px-3 py-2 text-left text-[11px] text-slate-200">
                    <p className="font-semibold text-slate-100">Public invoice link</p>
                    <p className="truncate font-mono text-[10px] text-amber-100">{invoiceLink}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="metric-label">Bill to</p>
                <p className="mt-2 text-base font-bold text-slate-950">{member?.full_name ?? '-'}</p>
                {member?.phone && <p className="mt-1 text-sm text-slate-600">{member.phone}</p>}
                {member?.email && <p className="mt-1 break-all text-sm text-slate-600">{member.email}</p>}
                {member?.address && <p className="mt-1 text-sm leading-6 text-slate-600">{member.address}</p>}
              </div>
              <div className="sm:text-right">
                <p className="metric-label">Invoice details</p>
                <div className="mt-2 space-y-2">
                  {[
                    ['Package', member?.package_name ?? '-'],
                    ['Due date', formatDate(invoice.due_date)],
                    ['Created', formatDate(invoice.created_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 text-sm sm:justify-end">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-slate-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-slate-950 px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-amber-300">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm">
                <span className="text-slate-700 font-medium">Membership fee - {member?.package_name ?? 'Package'} ({member?.package_duration ?? '-'})</span>
                <span className="font-semibold text-slate-950">{formatCurrency(invoice.membership_fee || invoice.amount)}</span>
              </div>
              {invoice.parq_fee && invoice.parq_fee > 0 ? (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t border-slate-100 px-4 py-3.5 text-sm">
                  <span className="text-slate-700 font-medium">PAR-Q Fee</span>
                  <span className="font-semibold text-slate-950">{formatCurrency(invoice.parq_fee)}</span>
                </div>
              ) : null}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-amber-300 bg-amber-300 px-4 py-4">
                <span className="text-sm font-bold text-zinc-950">Total due</span>
                <span className="text-lg font-bold text-zinc-950">{formatCurrency(invoice.amount)}</span>
              </div>
            </div>

            {invoice.notes && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="metric-label">Notes</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{invoice.notes}</p>
              </div>
            )}
          </div>
        </section>

        <SectionCard
          title="Payment status"
          description="Update the invoice as payment progresses."
        >
          <div className="segmented-control">
            {INVOICE_STATUSES.map((status) => {
              const Icon = statusIcons[status];
              const active = invoice.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => void handleStatusChange(status)}
                  disabled={updating || active}
                  className={cn('segment inline-flex items-center gap-2', active && 'segment-active')}
                >
                  {updating && !active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  {status}
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
