'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Receipt, Eye, ArrowRight, FileText } from 'lucide-react';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTInvoices } from '@/lib/actions/pt';
import { PTInvoice } from '@/types/pt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTInvoicesPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [invoices, setInvoices] = useState<PTInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setInvoices(demo.getPTInvoices());
      } else {
        const data = await getPTInvoices();
        setInvoices(data);
      }
    } catch (err: any) {
      toast.error('Failed to load invoices: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptInvoices]);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
                          inv.client?.full_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' ? true : inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = {
    Paid: invoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + Number(i.final_amount), 0),
    Pending: invoices.filter(i => i.status === 'Pending').reduce((sum, i) => sum + Number(i.balance_due), 0),
    Overdue: invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + Number(i.balance_due), 0)
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Invoices"
        subtitle="Manage billing lists, outstanding payment collection dues, and generate package receipts."
        action={
          (isAdmin || isReceptionist) && (
            <Link href="/pt/invoices/new" className="btn btn-primary">
              <Plus className="h-4 w-4" /> Create PT Invoice
            </Link>
          )
        }
      />

      {/* Summary Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Paid Revenue</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">{formatCurrency(totals.Paid)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Dues</p>
            <p className="mt-1 text-2xl font-black text-amber-300">{formatCurrency(totals.Pending)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
            <Receipt className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Overdue Dues</p>
            <p className="mt-1 text-2xl font-black text-red-400">{formatCurrency(totals.Overdue)}</p>
          </div>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="mb-6 p-4 sm:p-5 bg-zinc-950 border border-zinc-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              className="input pl-9 w-full"
              placeholder="Search by invoice number or client name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <span className="flex items-center text-sm text-zinc-400 gap-1 shrink-0">
              <Filter className="h-4 w-4" /> Filter Status:
            </span>
            <select
              className="input flex-1"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Invoices</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950 border border-zinc-800">
          <FileText className="mx-auto h-12 w-12 text-zinc-600" />
          <h3 className="mt-4 text-lg font-bold text-zinc-100 font-sans">No PT Invoices Found</h3>
          <p className="mt-2 text-zinc-400">Generate a personal training invoice to begin tracking billing records.</p>
        </Card>
      ) : (
        <div className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Client</th>
                  <th>Final Amount</th>
                  <th>Balance Due</th>
                  <th>Payment Method</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-amber-300" />
                        <span className="font-mono text-xs font-semibold text-zinc-300">{inv.invoice_number}</span>
                      </div>
                    </td>
                    <td><p className="font-bold text-zinc-100">{inv.client?.full_name}</p></td>
                    <td><p className="font-bold text-zinc-200">{formatCurrency(inv.final_amount)}</p></td>
                    <td>
                      <p className={`font-semibold ${inv.balance_due > 0 ? 'text-amber-300' : 'text-zinc-500'}`}>
                        {formatCurrency(inv.balance_due)}
                      </p>
                    </td>
                    <td><span className="text-xs text-zinc-400">{inv.payment_method || 'Unpaid'}</span></td>
                    <td><p className="text-xs text-zinc-400">{formatDate(inv.due_date)}</p></td>
                    <td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : inv.status === 'Overdue' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link href={`/pt/invoices/${inv.id}`} className="btn btn-ghost btn-sm">
                        View Details <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
