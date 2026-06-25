'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Inbox,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
  XCircle,
} from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import {
  dismissSMSAction,
  duplicateSMSAction,
  getSMSLogs,
  getSMSStats,
  markSMSAsSentAction,
  queueSMSNotificationAction,
  resendSMSAction,
  updateSMSMessageAction,
} from '@/lib/actions/sms';
import { getMembers } from '@/lib/actions/members';
import { getInvoices } from '@/lib/actions/invoices';
import { openNativeSms, renderSmsTemplate } from '@/lib/native-sms';
import { SMSLog, Member, Invoice } from '@/types';
import { formatDate, cn } from '@/lib/utils';

function getDaysUntilExpiry(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function statusBadge(status: string | null) {
  switch (status) {
    case 'Sent':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Failed':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Pending':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Skipped':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

const builtInTemplates = [
  {
    key: 'Welcome',
    name: 'Welcome Template',
    text: 'Hello {{member_name}},\nWelcome to FusionFit Gym.\nWe are excited to be part of your fitness journey.',
  },
  {
    key: 'Renewal',
    name: 'Renewal Reminder',
    text: 'Hello {{member_name}},\nYour membership expires on {{expiry_date}}.\nPlease renew your membership to continue training without interruption.',
  },
  {
    key: 'ExpiryWarning',
    name: 'Expiry Warning',
    text: 'Hello {{member_name}},\nYour membership will expire in {{days_left}} days.\nPlease renew to avoid interruption.',
  },
  {
    key: 'Payment',
    name: 'Payment Reminder',
    text: 'Hello {{member_name}},\nYour payment is pending.\nPlease contact us to complete your payment.',
  },
  {
    key: 'Invoice',
    name: 'Invoice Notification',
    text: 'Hello {{member_name}},\nInvoice #{{invoice_number}} has been generated.\nAmount: ₹{{amount}}',
  },
];

const DISMISSED_KEY = 'fusionfit_dismissed_sms';

type DismissedKey = string;

function buildDismissKey(memberId: string, context: string) {
  return `${memberId}:${context}`;
}

export default function SMSNotificationCenterPage() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<{
    todaySent: number;
    monthlySent: number;
    failed: number;
    pending: number;
    renewalRemindersSent: number;
    notificationQueue: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState('All');
  const [dismissed, setDismissed] = useState<Set<DismissedKey>>(new Set());
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [customTemplates, setCustomTemplates] = useState<{ name: string; text: string }[]>([]);
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);
  const [copiedTemplateName, setCopiedTemplateName] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<{
    logId?: string;
    memberId: string;
    phone: string;
    message: string;
    messageType: string;
    title: string;
  } | null>(null);
  const [previewLog, setPreviewLog] = useState<SMSLog | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      const [logsData, statsData, membersData, invoicesData] = await Promise.all([
        getSMSLogs(),
        getSMSStats(),
        getMembers().catch(() => []),
        getInvoices().catch(() => []),
      ]);
      setLogs(logsData);
      setStats(statsData);
      setMembers(membersData);
      setInvoices(invoicesData);
    } catch (err) {
      console.error('Failed to load SMS Notification Center:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const savedTemplates = localStorage.getItem('fusionfit_custom_templates');
    if (savedTemplates) {
      try {
        setCustomTemplates(JSON.parse(savedTemplates));
      } catch {
        /* ignore */
      }
    }
    const savedDismissed = localStorage.getItem(DISMISSED_KEY);
    if (savedDismissed) {
      try {
        setDismissed(new Set(JSON.parse(savedDismissed)));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getTemplateTextByKey = (key: string) => {
    const builtIn = builtInTemplates.find((t) => t.key === key);
    if (builtIn) return builtIn.text;
    const custom = customTemplates.find((t) => t.name === key);
    return custom?.text || '';
  };

  const buildMemberMessage = (member: Member, templateKey: string, extra: Record<string, string> = {}) => {
    const raw = getTemplateTextByKey(templateKey);
    return renderSmsTemplate(raw, {
      member_name: member.full_name,
      expiry_date: member.package_end_date ? formatDate(member.package_end_date) : 'N/A',
      days_left: String(getDaysUntilExpiry(member.package_end_date)),
      invoice_number: extra.invoice_number || 'INV-001',
      amount: extra.amount || String(member.package_price ?? '0'),
    });
  };

  const findPendingLog = (memberId: string, typeHint: string) =>
    logs.find(
      (l) =>
        l.member_id === memberId &&
        l.status === 'Pending' &&
        (l.message_type || l.sms_type || '').toLowerCase().includes(typeHint.toLowerCase())
    );

  const persistDismissed = (next: Set<DismissedKey>) => {
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  };

  const handleNativeSend = async (
    phone: string,
    message: string,
    logId?: string,
    memberId?: string | null,
    messageType?: string
  ) => {
    let activeLogId = logId;
    if (!activeLogId && memberId && messageType) {
      const queued = await queueSMSNotificationAction(memberId, phone, message, messageType);
      if (!queued.success) {
        alert(queued.message);
        return;
      }
      const freshLogs = await getSMSLogs();
      setLogs(freshLogs);
      const created = freshLogs.find(
        (l) => l.member_id === memberId && l.status === 'Pending' && l.message === message
      );
      activeLogId = created?.id;
    }

    const opened = openNativeSms(phone, message);
    if (!opened) {
      alert('No valid phone number available.');
      return;
    }

    if (activeLogId) {
      await markSMSAsSentAction(activeLogId);
      loadData();
    }
  };

  const handleDismiss = async (memberId: string, context: string, logId?: string) => {
    if (logId) {
      setActionLoadingId(logId);
      await dismissSMSAction(logId);
      setActionLoadingId(null);
      loadData();
      return;
    }
    const next = new Set(dismissed);
    next.add(buildDismissKey(memberId, context));
    persistDismissed(next);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    if (editModal.logId) {
      await updateSMSMessageAction(editModal.logId, editModal.message);
    } else if (editModal.memberId) {
      await queueSMSNotificationAction(
        editModal.memberId,
        editModal.phone,
        editModal.message,
        editModal.messageType
      );
    }
    setEditModal(null);
    loadData();
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateText) return;
    let updated: { name: string; text: string }[];
    if (editingTemplateName) {
      updated = customTemplates.map((t) =>
        t.name === editingTemplateName ? { name: newTemplateName, text: newTemplateText } : t
      );
    } else {
      updated = [...customTemplates, { name: newTemplateName, text: newTemplateText }];
    }
    setCustomTemplates(updated);
    localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setNewTemplateText('');
    setEditingTemplateName(null);
    setTemplateSuccess(editingTemplateName ? 'Template updated.' : 'Template created.');
    setTimeout(() => {
      setTemplateSuccess(null);
      setIsTemplateModalOpen(false);
    }, 1500);
  };

  const handleCopyTemplate = (name: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplateName(name);
    setTimeout(() => setCopiedTemplateName(null), 2000);
  };

  const yesterdaySent = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);
    return logs.filter(
      (l) =>
        l.status === 'Sent' &&
        l.created_at &&
        new Date(l.created_at) >= yesterday &&
        new Date(l.created_at) <= yesterdayEnd
    ).length;
  }, [logs]);

  const expiringGroups = useMemo(() => {
    const active = members.filter((m) => m.status === 'Active' && m.phone && m.package_end_date);
    const notDismissed = (m: Member, ctx: string) => !dismissed.has(buildDismissKey(m.id, ctx));
    return {
      today: active.filter((m) => getDaysUntilExpiry(m.package_end_date) === 0 && notDismissed(m, 'today')),
      threeDays: active.filter((m) => getDaysUntilExpiry(m.package_end_date) === 3 && notDismissed(m, '3days')),
      sevenDays: active.filter((m) => getDaysUntilExpiry(m.package_end_date) === 7 && notDismissed(m, '7days')),
    };
  }, [members, dismissed]);

  const recentInvoices = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return invoices
      .filter((inv) => inv.created_at && new Date(inv.created_at) >= thirtyDaysAgo)
      .slice(0, 8);
  }, [invoices]);

  const pendingQueue = useMemo(() => logs.filter((l) => l.status === 'Pending'), [logs]);

  const recentActivity = useMemo(() => {
    const searchText = searchQuery.toLowerCase();
    return logs.filter((log) => {
      const memberName = log?.member?.full_name || '';
      const phone = log?.phone_number || log?.phone || '';
      const matchesSearch =
        searchQuery === '' ||
        memberName.toLowerCase().includes(searchText) ||
        phone.includes(searchQuery);
      let matchesFilter = true;
      if (activityFilter === 'Sent') matchesFilter = log.status === 'Sent';
      else if (activityFilter === 'Pending') matchesFilter = log.status === 'Pending';
      else if (activityFilter === 'Failed') matchesFilter = log.status === 'Failed';
      else if (activityFilter === 'Skipped') matchesFilter = log.status === 'Skipped';
      return matchesSearch && matchesFilter;
    });
  }, [logs, searchQuery, activityFilter]);

  if (loading) return <LoadingSpinner size={40} />;

  const todayTrendUp = (stats?.todaySent ?? 0) >= yesterdaySent;

  const kpiCards = stats
    ? [
        { label: 'SMS Sent Today', value: stats.todaySent, icon: Send, trend: todayTrendUp },
        { label: 'SMS Sent This Month', value: stats.monthlySent, icon: Calendar },
        { label: 'Pending SMS', value: stats.pending, icon: Clock },
        { label: 'Failed SMS', value: stats.failed, icon: XCircle, alert: stats.failed > 0 },
        { label: 'Renewal Reminders Sent', value: stats.renewalRemindersSent, icon: Bell },
        { label: 'Notification Queue', value: stats.notificationQueue, icon: Inbox },
      ]
    : [];

  const renderExpirySection = (
    title: string,
    groupMembers: Member[],
    context: string,
    templateKey: string,
    messageType: string,
    urgent = false
  ) => (
    <div key={context}>
      <h4
        className={cn(
          'mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider',
          urgent ? 'text-red-600' : 'text-slate-500'
        )}
      >
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{groupMembers.length}</span>
      </h4>
      {groupMembers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
          No members in this category.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupMembers.map((member) => {
            const pendingLog = findPendingLog(member.id, messageType.split(' ')[0]);
            const message =
              pendingLog?.message || buildMemberMessage(member, templateKey, { days_left: String(getDaysUntilExpiry(member.package_end_date)) });
            return (
              <div
                key={member.id}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all duration-200 hover:border-amber-200 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{member.full_name}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono">{member.phone}</span>
                      <span>Expires: {formatDate(member.package_end_date)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionLoadingId === pendingLog?.id}
                      onClick={() =>
                        void handleNativeSend(
                          member.phone,
                          message,
                          pendingLog?.id,
                          member.id,
                          messageType
                        )
                      }
                      className="btn btn-primary btn-sm shadow-sm"
                    >
                      <Send className="mr-1.5 h-3.5 w-3.5" />
                      Send SMS
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditModal({
                          logId: pendingLog?.id,
                          memberId: member.id,
                          phone: member.phone,
                          message,
                          messageType,
                          title: `Edit — ${member.full_name}`,
                        })
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                      Edit Message
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDismiss(member.id, context, pendingLog?.id)}
                      className="btn btn-ghost btn-sm text-slate-500"
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="page page-enter">
      <PageHeader
        title="SMS Notification Center"
        subtitle="Manage pending member notifications, renewal reminders, and invoice alerts. Messages open in your device SMS app — no gateway required."
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary shadow-sm transition-all hover:shadow-md"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map(({ label, value, icon: Icon, trend, alert }) => (
          <article
            key={label}
            className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
              <div className={cn('rounded-lg bg-amber-50 p-1.5', alert ? 'text-red-500' : 'text-amber-600')}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-extrabold tracking-tight text-slate-900">{value}</p>
              {trend !== undefined && (
                <span
                  className={cn(
                    'mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    trend ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {trend && <TrendingUp className="h-3 w-3" />}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Smart Member Notifications */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
            <h3 className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Smart Member Notifications
            </h3>
            <div className="flex flex-col gap-6">
              {renderExpirySection(
                'Membership Expiring Today',
                expiringGroups.today,
                'today',
                'Renewal',
                'Renewal',
                true
              )}
              {renderExpirySection(
                'Membership Expiring In 3 Days',
                expiringGroups.threeDays,
                '3days',
                'ExpiryWarning',
                'Expiry Warning (3 days)'
              )}
              {renderExpirySection(
                'Membership Expiring In 7 Days',
                expiringGroups.sevenDays,
                '7days',
                'ExpiryWarning',
                'Expiry Warning (7 days)'
              )}

              <div>
                <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" />
                  Invoice Notifications
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                    {recentInvoices.length}
                  </span>
                </h4>
                {recentInvoices.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
                    No recent invoices.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentInvoices.map((inv) => {
                      const member = members.find((m) => m.id === inv.member_id);
                      const phone = member?.phone || inv.member?.phone;
                      const name = member?.full_name || inv.member?.full_name || 'Member';
                      const message = member
                        ? buildMemberMessage(member, 'Invoice', {
                            invoice_number: inv.invoice_number,
                            amount: String(inv.amount),
                          })
                        : renderSmsTemplate(getTemplateTextByKey('Invoice'), {
                            member_name: name,
                            invoice_number: inv.invoice_number,
                            amount: String(inv.amount),
                          });
                      const pendingLog = findPendingLog(inv.member_id, 'Invoice');
                      return (
                        <div
                          key={inv.id}
                          className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {inv.invoice_number} · ₹{inv.amount} · {inv.created_at ? formatDate(inv.created_at) : '—'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!phone}
                              onClick={() =>
                                phone &&
                                void handleNativeSend(phone, message, pendingLog?.id, inv.member_id, 'Invoice')
                              }
                              className="btn btn-primary btn-sm"
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              Send Invoice SMS
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewMessage(message)}
                              className="btn btn-secondary btn-sm"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Preview Message
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Pending SMS Queue */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Inbox className="h-4 w-4 text-amber-500" />
                Pending SMS Queue
              </h3>
              <span className="text-xs font-semibold text-amber-700">{pendingQueue.length} pending</span>
            </div>
            {pendingQueue.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="Queue is empty"
                  description="ERP automations will add pending notifications here when memberships expire, invoices are generated, or payments are due."
                />
              </div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Phone Number</th>
                      <th>Message Type</th>
                      <th>Created Time</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingQueue.map((log) => {
                      const phone = log.phone_number || log.phone || '—';
                      const smsType = log.message_type || log.sms_type || '—';
                      const isLoading = actionLoadingId === log.id;
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="table-primary">{log.member?.full_name || '—'}</td>
                          <td className="font-mono text-xs">{phone}</td>
                          <td>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">{smsType}</span>
                          </td>
                          <td className="text-xs text-slate-600">
                            {log.created_at ? formatDate(log.created_at) : '—'}
                            <span className="block text-[10px] text-slate-400">
                              {log.created_at
                                ? new Date(log.created_at).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—'}
                            </span>
                          </td>
                          <td>
                            <span className={cn('badge border text-xs', statusBadge(log.status))}>
                              {log.status || 'Pending'}
                            </span>
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() =>
                                void handleNativeSend(phone, log.message, log.id, log.member_id, smsType)
                              }
                              className="btn btn-primary btn-xs"
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Send SMS
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent SMS Activity */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
                <MessageSquare className="h-4 w-4 text-amber-500" />
                Recent SMS Activity
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="input-with-icon max-w-sm w-full">
                  <Search className="h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search member or phone..."
                    className="input-field"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {['All', 'Sent', 'Pending', 'Failed', 'Skipped'].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActivityFilter(f)}
                      className={cn(
                        'rounded-lg border px-3 py-1 text-xs font-semibold transition-colors',
                        activityFilter === f
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {recentActivity.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No activity found" />
              </div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Member</th>
                      <th>Phone</th>
                      <th>Message Type</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentActivity.slice(0, 25).map((log) => {
                      const phone = log.phone_number || log.phone || '—';
                      const smsType = log.message_type || log.sms_type || '—';
                      const isLoading = actionLoadingId === log.id;
                      return (
                        <tr key={log.id}>
                          <td className="text-xs text-slate-600">
                            {log.created_at ? formatDate(log.created_at) : '—'}
                          </td>
                          <td className="table-primary">{log.member?.full_name || '—'}</td>
                          <td className="font-mono text-xs">{phone}</td>
                          <td>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold">{smsType}</span>
                          </td>
                          <td>
                            <span className={cn('badge border text-xs', statusBadge(log.status))}>
                              {log.status || '—'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => setPreviewLog(log)}
                                title="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={isLoading}
                                onClick={async () => {
                                  setActionLoadingId(log.id);
                                  await resendSMSAction(log.id);
                                  setActionLoadingId(null);
                                  loadData();
                                }}
                                title="Resend"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={isLoading}
                                onClick={async () => {
                                  setActionLoadingId(log.id);
                                  await duplicateSMSAction(log.id);
                                  setActionLoadingId(null);
                                  loadData();
                                }}
                                title="Duplicate"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Templates */}
        <div className="lg:col-span-4">
          <section className="sticky top-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="h-4 w-4 text-amber-500" />
                SMS Templates
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplateName(null);
                  setNewTemplateName('');
                  setNewTemplateText('');
                  setIsTemplateModalOpen(true);
                }}
                className="btn btn-secondary btn-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                Create
              </button>
            </div>
            <div className="flex max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto">
              {[...builtInTemplates, ...customTemplates.map((t) => ({ ...t, key: t.name, isCustom: true }))].map(
                (tpl) => (
                  <div
                    key={tpl.key}
                    className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-all hover:border-amber-200 hover:shadow-sm"
                  >
                    <p className="text-xs font-bold text-slate-800">{tpl.name}</p>
                    <p className="mt-1 line-clamp-3 font-mono text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap">
                      {tpl.text}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewMessage(tpl.text)}
                        className="btn btn-ghost btn-xs"
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyTemplate(tpl.name, tpl.text)}
                        className="btn btn-ghost btn-xs"
                      >
                        {copiedTemplateName === tpl.name ? (
                          <Check className="mr-1 h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if ('isCustom' in tpl && tpl.isCustom) {
                            setEditingTemplateName(tpl.name);
                            setNewTemplateName(tpl.name);
                            setNewTemplateText(tpl.text);
                          } else {
                            setEditingTemplateName(null);
                            setNewTemplateName(`${tpl.name} (Copy)`);
                            setNewTemplateText(tpl.text);
                          }
                          setIsTemplateModalOpen(true);
                        }}
                        className="btn btn-ghost btn-xs"
                      >
                        <Edit3 className="mr-1 h-3 w-3" />
                        Edit
                      </button>
                      {'isCustom' in tpl && tpl.isCustom ? (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = customTemplates.filter((t) => t.name !== tpl.name);
                            setCustomTemplates(updated);
                            localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
                          }}
                          className="btn btn-ghost btn-xs text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplateName(null);
                            setNewTemplateName(`${tpl.name} (Copy)`);
                            setNewTemplateText(tpl.text);
                            setIsTemplateModalOpen(true);
                          }}
                          className="btn btn-ghost btn-xs"
                        >
                          Duplicate
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
              Variables: {'{{member_name}}'}, {'{{expiry_date}}'}, {'{{amount}}'}, {'{{invoice_number}}'}, {'{{days_left}}'}
            </p>
          </section>
        </div>
      </div>

      {/* Edit Message Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="card relative z-10 w-full max-w-lg p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Edit3 className="h-5 w-5 text-amber-500" />
              {editModal.title}
            </h3>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <textarea
                className="input-field min-h-32 resize-y text-sm"
                value={editModal.message}
                onChange={(e) => setEditModal({ ...editModal, message: e.target.value })}
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsTemplateModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 text-base font-bold text-slate-900">
              {editingTemplateName ? 'Edit Template' : 'Create Template'}
            </h3>
            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
              <input
                className="input-field"
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                required
              />
              <textarea
                className="input-field min-h-28 resize-y text-sm"
                placeholder="Message body with {{variables}}"
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                required
              />
              {templateSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  {templateSuccess}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setIsTemplateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {(previewLog || previewMessage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => {
              setPreviewLog(null);
              setPreviewMessage(null);
            }}
          />
          <div className="card relative z-10 w-full max-w-md p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-5 w-5 text-amber-500" />
              Message Preview
            </h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-line leading-relaxed">
              {previewLog?.message || previewMessage}
            </div>
            {previewLog && previewLog.status === 'Pending' && (
              <button
                type="button"
                className="btn btn-primary mt-4 w-full"
                onClick={() => {
                  const phone = previewLog.phone_number || previewLog.phone || '';
                  void handleNativeSend(
                    phone,
                    previewLog.message,
                    previewLog.id,
                    previewLog.member_id,
                    previewLog.message_type || previewLog.sms_type || 'Custom'
                  );
                  setPreviewLog(null);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Send SMS
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary mt-3 w-full"
              onClick={() => {
                setPreviewLog(null);
                setPreviewMessage(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
