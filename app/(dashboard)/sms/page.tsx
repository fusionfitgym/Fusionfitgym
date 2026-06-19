'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getSMSLogs, getSMSStats } from '@/lib/actions/sms';
import { SMSLog } from '@/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function SMSLogsPage() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [stats, setStats] = useState<{
    totalSent: number;
    failed: number;
    todaySent: number;
    monthlyCost: number;
    successRate: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Load data
  async function loadData() {
    try {
      const [logsData, statsData] = await Promise.all([
        getSMSLogs(),
        getSMSStats(),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load SMS log data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Filter logic
  const filtered = logs.filter((log) => {
    const nameMatch = log.member?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    const phoneMatch = log.phone.includes(searchQuery);
    const msgMatch = log.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = searchQuery === '' || nameMatch || phoneMatch || msgMatch;

    const matchesType = typeFilter === 'All' || log.sms_type === typeFilter;
    const matchesStatus = statusFilter === 'All' || log.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const smsTypes = ['All', 'Invoice', 'Welcome', 'Renewal', 'Expiry Warning', 'Expired', 'Test'];
  const smsStatuses = ['All', 'Sent', 'Failed', 'Skipped'];

  if (loading) return <LoadingSpinner size={40} />;

  return (
    <div className="page page-enter">
      <PageHeader
        title="SMS Logs"
        subtitle="Monitor delivery statuses, message templates, gateway responses, and system costs."
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh logs
          </button>
        }
      />

      {/* Statistics Cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Sent',
              value: stats.totalSent,
              icon: Send,
              color: 'text-emerald-700',
              surface: 'bg-emerald-50',
            },
            {
              label: 'Failed SMS',
              value: stats.failed,
              icon: AlertCircle,
              color: 'text-red-700',
              surface: 'bg-red-50',
            },
            {
              label: "Today's SMS",
              value: stats.todaySent,
              icon: Calendar,
              color: 'text-blue-700',
              surface: 'bg-blue-50',
            },
            {
              label: 'Monthly SMS Cost',
              value: `₹${stats.monthlyCost.toFixed(2)}`,
              icon: CreditCard,
              color: 'text-amber-700',
              surface: 'bg-amber-50',
              desc: 'Est. ₹0.25 / SMS',
            },
          ].map(({ label, value, icon: Icon, color, surface, desc }) => (
            <article key={label} className="card flex min-h-32 items-center gap-4 p-5">
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', surface, color)}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className={cn('text-xs font-semibold uppercase tracking-[0.06em]', color)}>{label}</p>
                <p className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-950">{value}</p>
                {desc && <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Filter and Search Bar */}
      <section className="card mb-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="input-with-icon max-w-md">
            <Search className="h-4 w-4" />
            <input
              type="text"
              placeholder="Search member, phone or message text..."
              className="input-field"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SMS Type</span>
              <div className="segmented-control">
                {smsTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    className={cn('segment btn-sm', typeFilter === type && 'segment-active')}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</span>
              <div className="segmented-control">
                {smsStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn('segment btn-sm', statusFilter === status && 'segment-active')}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No SMS logs found"
          description={logs.length === 0 ? 'SMS logs will appear here once notifications are triggered.' : 'No logs match the selected filter criteria.'}
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Member Name</th>
                  <th>Phone</th>
                  <th>SMS Type</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const formattedStatus = log.status === 'Sent' ? 'Paid' : log.status === 'Failed' ? 'Overdue' : 'Pending'; // Match status badge variants
                  return (
                    <tr key={log.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => toggleExpandLog(log.id)}>
                      <td className="font-medium text-slate-700 text-xs">
                        {formatDate(log.created_at)}
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <p className="table-primary">{log.member?.full_name ?? '—'}</p>
                        {log.member_id && <span className="text-[10px] text-slate-400 font-mono block mt-0.5">ID: {log.member_id.substring(0, 8)}...</span>}
                      </td>
                      <td className="font-mono text-xs text-slate-600">{log.phone}</td>
                      <td>
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
                          {log.sms_type}
                        </span>
                      </td>
                      <td>
                        {/* Map logs status to available StatusBadge styles */}
                        {log.status === 'Sent' && <span className="badge badge-active">Sent</span>}
                        {log.status === 'Failed' && <span className="badge badge-inactive">Failed</span>}
                        {log.status === 'Skipped' && <span className="badge badge-expired">Skipped</span>}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandLog(log.id);
                          }}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expandable Panel for Message Content (inside a portal/adjacent block if we want it perfect, or standard React row expansion) */}
          {expandedLogId && (
            (() => {
              const currentLog = filtered.find(l => l.id === expandedLogId);
              if (!currentLog) return null;
              return (
                <div className="bg-slate-50 border-t border-b border-slate-200 p-5 font-sans animate-enter">
                  <div className="flex flex-col gap-4 md:flex-row md:justify-between">
                    <div className="flex-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Message Content</h4>
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-sm whitespace-pre-line text-slate-800 max-w-2xl leading-relaxed">
                        {currentLog.message}
                      </div>
                    </div>
                    <div className="w-full md:w-80 shrink-0">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Gateway Response</h4>
                      <div className="bg-zinc-900 text-zinc-100 rounded-xl p-4 font-mono text-[11px] break-all leading-normal max-h-36 overflow-y-auto">
                        {currentLog.provider_response || 'No response recorded.'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200/60 pt-3">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setExpandedLogId(null)}
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              );
            })()
          )}

          {/* Mobile view card representation */}
          <div className="data-cards">
            {filtered.map((log) => (
              <article key={log.id} className="mobile-record" onClick={() => toggleExpandLog(log.id)}>
                <div className="mobile-record-header">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 mb-1">
                      {log.sms_type}
                    </span>
                    <p className="font-semibold text-slate-900 text-sm">{log.member?.full_name ?? '—'}</p>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">{log.phone}</p>
                  </div>
                  <div>
                    {log.status === 'Sent' && <span className="badge badge-active">Sent</span>}
                    {log.status === 'Failed' && <span className="badge badge-inactive">Failed</span>}
                    {log.status === 'Skipped' && <span className="badge badge-expired">Skipped</span>}
                  </div>
                </div>
                <div className="mobile-record-meta text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Timestamp</span>
                    <span className="font-semibold text-slate-700">{formatDate(log.created_at)} at {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                
                {expandedLogId === log.id && (
                  <div className="mt-3 border-t border-slate-100 pt-3 flex flex-col gap-3">
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-1">Message</span>
                      <p className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-200 whitespace-pre-line text-slate-800 leading-relaxed">
                        {log.message}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-1">Gateway Log</span>
                      <p className="bg-zinc-900 text-zinc-100 rounded-lg p-3 font-mono text-[10px] break-all leading-normal max-h-24 overflow-y-auto">
                        {log.provider_response || '—'}
                      </p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
