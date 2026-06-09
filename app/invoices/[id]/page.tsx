'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { getInvoiceById, updateInvoiceStatus } from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { Invoice, GymSettings, INVOICE_STATUSES } from '@/types';
import { Card, LoadingSpinner } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    Promise.all([getInvoiceById(id), getSettings()]).then(([inv, s]) => {
      setInvoice(inv);
      setSettings(s);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(status: Invoice['status']) {
    if (!invoice) return;
    setUpdating(true);
    try {
      await updateInvoiceStatus(id, status);
      setInvoice(prev => prev ? { ...prev, status } : null);
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

  if (loading) return <LoadingSpinner size={36} />;
  if (!invoice) return <div className="text-gray-500 text-center py-16">Invoice not found.</div>;

  const member = invoice.member as { full_name: string; phone?: string; email?: string; address?: string; membership_plan?: string } | undefined;
  const statusIcons = { Paid: CheckCircle, Pending: Clock, Overdue: AlertCircle };

  return (
    <div className="page-enter max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/invoices" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
          <p className="text-sm text-gray-400">Created {formatDate(invoice.created_at)}</p>
        </div>
        <button onClick={handleDownloadPDF} disabled={downloading} className="btn-yellow text-sm">
          {downloading ? <Loader2 className="w-4 h-4 spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>
      </div>

      <div className="space-y-4">
        {/* Invoice Preview */}
        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          {/* Invoice Header */}
          <div className="p-6 text-white" style={{ background: 'var(--gym-black)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--gym-yellow)', fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                  {settings?.gym_name ?? 'FusionFit Gym'}
                </h2>
                <p className="text-gray-400 text-xs mt-1">{settings?.gym_address}</p>
                <p className="text-gray-400 text-xs">{settings?.gym_phone} | {settings?.gym_email}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Invoice</p>
                <p className="font-mono font-bold text-white">{invoice.invoice_number}</p>
                <div className="mt-2"><StatusBadge variant={invoice.status} /></div>
              </div>
            </div>
          </div>

          {/* Invoice Body */}
          <div className="p-6 bg-white">
            {/* Bill To / Details */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Bill To</p>
                <p className="font-bold text-gray-900">{member?.full_name}</p>
                {member?.phone && <p className="text-sm text-gray-500">{member.phone}</p>}
                {member?.email && <p className="text-sm text-gray-500">{member.email}</p>}
                {member?.address && <p className="text-sm text-gray-500">{member.address}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Details</p>
                <div className="space-y-1">
                  {[
                    ['Plan',     member?.membership_plan ?? '—'],
                    ['Due Date', formatDate(invoice.due_date)],
                    ['Created',  formatDate(invoice.created_at)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-end gap-3 text-sm">
                      <span className="text-gray-400">{label}:</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--gym-black)' }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gym-yellow)' }}>Description</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gym-yellow)' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-50">
                    <td className="px-4 py-3 text-gray-700">Membership Fee — {member?.membership_plan}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(invoice.amount)}</td>
                  </tr>
                </tbody>
                <tfoot style={{ background: 'var(--gym-yellow)' }}>
                  <tr>
                    <td className="px-4 py-3 font-bold text-black">TOTAL DUE</td>
                    <td className="px-4 py-3 text-right font-bold text-black text-lg">{formatCurrency(invoice.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {invoice.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Change */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Update Payment Status</h3>
          <div className="flex gap-2 flex-wrap">
            {INVOICE_STATUSES.map(status => {
              const Icon = statusIcons[status];
              const isActive = invoice.status === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={updating || isActive}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? 'text-black' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  } disabled:opacity-50`}
                  style={isActive ? { background: 'var(--gym-yellow)' } : {}}
                >
                  {updating ? <Loader2 className="w-3.5 h-3.5 spin" /> : <Icon className="w-3.5 h-3.5" />}
                  {status}
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
