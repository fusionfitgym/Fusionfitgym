'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getInvoices } from '@/lib/actions/invoices';
import { Invoice, INVOICE_STATUSES } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filtered, setFiltered] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    getInvoices().then(data => { setInvoices(data); setFiltered(data); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setFiltered(statusFilter === 'All' ? invoices : invoices.filter(i => i.status === statusFilter));
  }, [statusFilter, invoices]);

  const totals = {
    paid:    invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount), 0),
    pending: invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + Number(i.amount), 0),
    overdue: invoices.filter(i => i.status === 'Overdue').reduce((s, i) => s + Number(i.amount), 0),
  };

  return (
    <div className="page-enter">
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Paid',    value: totals.paid,    color: '#065f46', bg: '#d1fae5' },
          { label: 'Pending', value: totals.pending, color: '#92400e', bg: '#fef3c7' },
          { label: 'Overdue', value: totals.overdue, color: '#991b1b', bg: '#fee2e2' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="rounded-2xl p-4 border border-gray-100 bg-white text-center card-glow">
            <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <Card className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {['All', ...INVOICE_STATUSES].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === s ? 'text-black' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
              style={statusFilter === s ? { background: 'var(--gym-yellow)' } : {}}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(inv => {
                  const member = inv.member as { full_name: string } | undefined;
                  return (
                    <tr key={inv.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-[#FFD700]" />
                          </div>
                          <span className="font-mono text-xs font-semibold text-gray-900">{inv.invoice_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">{member?.full_name ?? '—'}</td>
                      <td className="px-4 py-4 font-semibold text-gray-900 hidden sm:table-cell">{formatCurrency(inv.amount)}</td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-4"><StatusBadge variant={inv.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/invoices/${inv.id}`} className="text-xs font-semibold text-[#E6C200] hover:underline">View →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
