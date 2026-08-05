'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  FileCheck,
  Receipt,
  Search,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getMonthlyCycleRange,
  isInvoiceInCycle,
  cn,
} from '@/lib/utils';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/Primitives';

interface MonthlyRevenueSectionProps {
  invoices: any[];
  referenceDate?: Date | string;
}

export function MonthlyRevenueSection({
  invoices = [],
  referenceDate,
}: MonthlyRevenueSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllInvoices, setShowAllInvoices] = useState(false);

  // Compute 4th-to-3rd monthly cycle date range
  const cycle = useMemo(() => {
    return getMonthlyCycleRange(referenceDate);
  }, [referenceDate]);

  // Paid invoices belonging strictly to the current 4th date cycle
  const cyclePaidInvoices = useMemo(() => {
    return invoices
      .filter((inv) => isInvoiceInCycle(inv, cycle))
      .sort((a, b) => {
        const dateA = new Date(a.payment_date || a.created_at || 0).getTime();
        const dateB = new Date(b.payment_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [invoices, cycle]);

  // Total monthly revenue for the current 4th date cycle
  const monthlyRevenue = useMemo(() => {
    return cyclePaidInvoices.reduce(
      (sum, inv) => sum + Number(inv.paid_amount || inv.amount || 0),
      0
    );
  }, [cyclePaidInvoices]);

  // All paid invoices across all time
  const allPaidInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => String(inv?.status || '').toLowerCase() === 'paid'
    );
  }, [invoices]);

  const totalAllTimeRevenue = useMemo(() => {
    return allPaidInvoices.reduce(
      (sum, inv) => sum + Number(inv.paid_amount || inv.amount || 0),
      0
    );
  }, [allPaidInvoices]);

  // Average invoice amount in cycle
  const avgInvoiceAmount = useMemo(() => {
    return cyclePaidInvoices.length > 0
      ? monthlyRevenue / cyclePaidInvoices.length
      : 0;
  }, [cyclePaidInvoices, monthlyRevenue]);

  // Filtered cycle paid invoices based on search
  const filteredCycleInvoices = useMemo(() => {
    if (!searchQuery.trim()) return cyclePaidInvoices;
    const q = searchQuery.toLowerCase().trim();
    return cyclePaidInvoices.filter((inv) => {
      const memberName =
        inv.member?.full_name || inv.member_name || inv.guest_name || '';
      const invoiceNo = inv.invoice_number || '';
      const phone = inv.member?.phone || inv.guest_phone || '';
      const payMethod = inv.payment_method || '';
      return (
        memberName.toLowerCase().includes(q) ||
        invoiceNo.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        payMethod.toLowerCase().includes(q)
      );
    });
  }, [cyclePaidInvoices, searchQuery]);

  const displayedInvoices = showAllInvoices
    ? filteredCycleInvoices
    : filteredCycleInvoices.slice(0, 5);

  return (
    <section className="mt-6 space-y-4">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Monthly Revenue & Paid Invoices
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              Monthly Cycle (4th - 3rd)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Current billing cycle running from{' '}
            <strong className="text-slate-700">{cycle.formattedRange}</strong>{' '}
            (Cycle resets on the 4th date of every month)
          </p>
        </div>

        <Link
          href="/invoices"
          className="btn btn-ghost btn-sm text-emerald-700 hover:text-emerald-800 self-start sm:self-auto"
        >
          Manage All Invoices <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Monthly Revenue (4th-3rd) */}
        <div className="card p-5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Monthly Revenue
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(monthlyRevenue)}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              Cycle: {cycle.startDayMonth} – {cycle.endDayMonth}
            </p>
          </div>
        </div>

        {/* Card 2: Cycle Paid Invoices */}
        <div className="card p-5 border-l-4 border-l-blue-500 bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Paid Invoices (Cycle)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {cyclePaidInvoices.length}
            </p>
            <p className="text-[11px] text-blue-700 font-medium mt-1">
              Paid invoices recorded in 4th date cycle
            </p>
          </div>
        </div>

        {/* Card 3: Average Invoice Value */}
        <div className="card p-5 border-l-4 border-l-indigo-500 bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Avg. Paid Invoice
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(avgInvoiceAmount)}
            </p>
            <p className="text-[11px] text-indigo-700 font-medium mt-1">
              Average value per paid invoice in cycle
            </p>
          </div>
        </div>

        {/* Card 4: All-Time Paid Revenue */}
        <div className="card p-5 border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Revenue (All-Time)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrency(totalAllTimeRevenue)}
            </p>
            <p className="text-[11px] text-amber-700 font-medium mt-1">
              {allPaidInvoices.length} paid invoices across all time
            </p>
          </div>
        </div>
      </div>

      {/* Paid Invoices Table / Roster Card */}
      <div className="card overflow-hidden">
        {/* Card Header & Search */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              Paid Invoices (Cycle: {cycle.formattedRange})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              List of all paid invoices recorded during the active 4th to 4th monthly cycle
            </p>
          </div>

          <div className="relative min-w-56">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by member or invoice #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Invoice Roster Table */}
        {filteredCycleInvoices.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={<Receipt className="h-6 w-6 text-slate-400" />}
              title={
                searchQuery
                  ? 'No matching paid invoices found'
                  : 'No paid invoices in this cycle yet'
              }
              description={
                searchQuery
                  ? 'Try searching with a different member name or invoice number.'
                  : `Paid invoices recorded between ${cycle.formattedRange} will automatically display here.`
              }
            />
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3 sm:px-6">
                      Invoice #
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Member / Client
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Payment Date
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Payment Method
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="px-4 py-3 text-center">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedInvoices.map((inv) => {
                    const memberName =
                      inv.member?.full_name ||
                      inv.member_name ||
                      inv.guest_name ||
                      'Member';
                    const phone = inv.member?.phone || inv.guest_phone || '';
                    const payDate = inv.payment_date || inv.created_at;
                    const amount = Number(inv.paid_amount || inv.amount || 0);

                    return (
                      <tr
                        key={inv.id || inv.invoice_number}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 sm:px-6">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-emerald-700 hover:text-emerald-800 underline decoration-emerald-300 underline-offset-2"
                          >
                            {inv.invoice_number || 'INV-—'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {memberName}
                          </div>
                          {phone && (
                            <div className="text-[11px] text-slate-400">
                              {phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDate(payDate)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                            {inv.payment_method || 'Paid Transaction'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-950">
                          {formatCurrency(amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge variant="Paid" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            View <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination / Expand Footer */}
            {filteredCycleInvoices.length > 5 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:px-6">
                <span className="text-xs text-slate-500">
                  Showing {displayedInvoices.length} of{' '}
                  {filteredCycleInvoices.length} paid invoices in this cycle
                </span>
                <button
                  type="button"
                  onClick={() => setShowAllInvoices(!showAllInvoices)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {showAllInvoices ? (
                    <>
                      Show less <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Show all {filteredCycleInvoices.length} paid invoices{' '}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default MonthlyRevenueSection;
