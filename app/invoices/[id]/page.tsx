'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  Loader2,
} from 'lucide-react';
import {
  Breadcrumb,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getInvoiceById, updateInvoiceStatus } from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { GymSettings, Invoice, INVOICE_STATUSES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([getInvoiceById(id), getSettings()])
      .then(([invoiceData, settingsData]) => {
        setInvoice(invoiceData);
        setSettings(settingsData);
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
      generateInvoicePDF(invoice, settings);
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
    membership_plan?: string;
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
                    ['Plan', member?.membership_plan ?? '-'],
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
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 text-sm">
                <span className="text-slate-700">Membership fee - {member?.membership_plan ?? 'Plan'}</span>
                <span className="font-semibold text-slate-950">{formatCurrency(invoice.amount)}</span>
              </div>
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
