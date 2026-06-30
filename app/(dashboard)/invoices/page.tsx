'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText, Plus, ReceiptText } from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getInvoices } from '@/lib/actions/invoices';
import { Invoice, INVOICE_STATUSES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';

export default function InvoicesPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    if (isDemo) {
      setInvoices(demo.invoices);
      setLoading(false);
      return;
    }
    getInvoices()
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, [isDemo, demo.invoices]);

  const filtered = statusFilter === 'All'
    ? invoices
    : invoices.filter((invoice) => invoice.status === statusFilter);

  const totals = {
    Paid: invoices.filter((invoice) => invoice.status === 'Paid').reduce((sum, invoice) => sum + Number(invoice.amount), 0),
    Pending: invoices.filter((invoice) => invoice.status === 'Pending').reduce((sum, invoice) => sum + Number(invoice.amount), 0),
    Overdue: invoices.filter((invoice) => invoice.status === 'Overdue').reduce((sum, invoice) => sum + Number(invoice.amount), 0),
  };

  const summary = [
    { label: 'Paid', value: totals.Paid, color: 'text-emerald-700', surface: 'bg-emerald-50' },
    { label: 'Pending', value: totals.Pending, color: 'text-amber-700', surface: 'bg-amber-50' },
    { label: 'Overdue', value: totals.Overdue, color: 'text-red-700', surface: 'bg-red-50' },
  ];

  return (
    <div className="page page-enter">
      <PageHeader
        title="Invoices"
        subtitle="Manage membership charges, due dates, and payment status."
        action={
          <Link href="/invoices/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> Create invoice
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summary.map(({ label, value, color, surface }) => (
          <article key={label} className="card flex min-h-32 items-center gap-4 p-5">
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', surface, color)}>
              <ReceiptText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className={cn('text-xs font-semibold uppercase tracking-[0.06em]', color)}>{label}</p>
              <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-950">{formatCurrency(value)}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="card mb-6 p-4 sm:p-6">
        <div className="segmented-control" aria-label="Filter invoices by status">
          {['All', ...INVOICE_STATUSES].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn('segment', statusFilter === status && 'segment-active')}
              aria-pressed={statusFilter === status}
            >
              {status}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No invoices found"
          description={invoices.length === 0 ? 'Create the first invoice to begin tracking membership payments.' : 'No invoices match this status filter.'}
          action={
            invoices.length === 0 ? (
              <Link href="/invoices/new" className="btn btn-primary">
                <Plus className="h-4 w-4" /> Create invoice
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Member</th>
                  <th className="hidden sm:table-cell">Amount</th>
                  <th className="hidden md:table-cell">Due date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((invoice) => {
                  const member = invoice.member as { full_name: string } | undefined;
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-900">{invoice.invoice_number}</span>
                        </div>
                      </td>
                      <td><p className="table-primary">{member?.full_name ?? '-'}</p></td>
                      <td className="hidden font-semibold text-slate-900 sm:table-cell">{formatCurrency(invoice.amount)}</td>
                      <td className="hidden md:table-cell">{formatDate(invoice.due_date)}</td>
                      <td><StatusBadge variant={invoice.status} /></td>
                      <td className="text-right">
                        <Link href={`/invoices/${invoice.id}`} className="btn btn-ghost btn-sm">
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="data-cards">
            {filtered.map((invoice) => {
              const member = invoice.member as { full_name: string } | undefined;
              return (
                <article key={invoice.id} className="mobile-record">
                  <div className="mobile-record-header">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-semibold text-slate-900">{invoice.invoice_number}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{member?.full_name ?? '-'}</p>
                      </div>
                    </div>
                    <StatusBadge variant={invoice.status} />
                  </div>
                  <div className="mobile-record-meta">
                    <div>
                      <p className="metric-label">Amount</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(invoice.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="metric-label">Due date</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                  <div className="mobile-record-actions">
                    <Link href={`/invoices/${invoice.id}`} className="btn btn-secondary btn-sm">View invoice</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
