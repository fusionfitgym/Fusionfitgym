'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getInvoices } from '@/lib/actions/invoices';
import { Invoice, INVOICE_STATUSES } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    getInvoices().then(data => { setInvoices(data); }).finally(() => setLoading(false));
  }, []);

  const filtered = statusFilter === 'All' ? invoices : invoices.filter(i => i.status === statusFilter);

  const totals = {
    paid:    invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0),
    pending: invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + Number(i.amount), 0),
    overdue: invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + Number(i.amount), 0),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <PageHeader
        title="Invoices"
        subtitle="Manage membership payments"
        action={
          <Link href="/invoices/new" className="btn-yellow text-sm">
            <Plus className="w-4 h-4" /> Create Invoice
          </Link>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Paid',    value: totals.paid,    color: '#166534', bg: '#DCFCE7' },
          { label: 'Pending', value: totals.pending, color: '#92400E', bg: '#FEF3C7' },
          { label: 'Overdue', value: totals.overdue, color: '#991B1B', bg: '#FEE2E2' },
        ].map(({ label, value, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.08 }}
            className="card p-6 card-hover"
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color }}>{label}</p>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(value)}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <Card className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {['All', ...INVOICE_STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                statusFilter === s ? 'text-black shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
              style={statusFilter === s ? { background: 'var(--color-primary)' } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner size={36} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No invoices found"
          action={<Link href="/invoices/new" className="btn-yellow text-sm"><Plus className="w-4 h-4" /> Create Invoice</Link>}
        />
      ) : (
        <Card padding={false}>
          <div className="data-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Amount</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Due Date</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(inv => {
                  const member = inv.member as { full_name: string } | undefined;
                  return (
                    <tr key={inv.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-amber-500" />
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-900">{inv.invoice_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{member?.full_name ?? '—'}</td>
                      <td className="px-4 py-4 font-semibold text-slate-900 hidden sm:table-cell">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-4 text-slate-500 hidden md:table-cell">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-4"><StatusBadge variant={inv.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/invoices/${inv.id}`} className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline transition-colors">View →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="data-cards flex-col divide-y divide-slate-100 hidden">
            {filtered.map(inv => {
              const member = inv.member as { full_name: string } | undefined;
              return (
                <div key={inv.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-mono text-xs font-semibold text-slate-900">{inv.invoice_number}</p>
                        <p className="text-sm font-medium text-slate-900">{member?.full_name ?? '—'}</p>
                      </div>
                    </div>
                    <StatusBadge variant={inv.status} />
                  </div>
                  
                  <div className="flex items-center justify-between mt-1 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-slate-500 text-xs">Amount</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(inv.amount)}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-slate-500 text-xs">Due Date</span>
                      <span className="font-medium text-slate-900">{formatDate(inv.due_date)}</span>
                    </div>
                  </div>

                  <div className="mt-2 pt-3 border-t border-slate-50">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="block w-full py-2 text-center rounded-lg bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 transition-colors"
                    >
                      View Invoice
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
