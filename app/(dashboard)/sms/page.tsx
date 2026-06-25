'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Battery,
  Bell,
  Calendar,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Info,
  Loader2,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Signal,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wifi,
  XCircle,
  Check,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import {
  deleteSMSAction,
  getSMSDevice,
  getSMSLogs,
  getSMSStats,
  retrySMSAction,
  sendBulkSMSAction,
  sendSMSAction,
  testConnectionAction,
} from '@/lib/actions/sms';
import { getMembers } from '@/lib/actions/members';
import { SMSLog, Member } from '@/types';
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
    case 'Cancelled':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

const builtInTemplates = [
  {
    key: 'Welcome',
    name: 'Welcome Member',
    text: 'Hello {{member_name}},\nWelcome to FusionFit Gym.\nWe are excited to be part of your fitness journey.',
    description: 'Dispatched to newly registered members',
  },
  {
    key: 'Renewal',
    name: 'Renewal Reminder',
    text: 'Hello {{member_name}},\nYour membership expires on {{expiry_date}}.\nPlease renew your membership to continue training without interruption.',
    description: 'Pre-expiry renewal notification',
  },
  {
    key: 'Invoice',
    name: 'Invoice Generated',
    text: 'Hello {{member_name}},\nInvoice #{{invoice_number}} has been generated.\nAmount: ₹{{amount}}',
    description: 'Invoice notification for members',
  },
  {
    key: 'Expired',
    name: 'Membership Expired',
    text: 'Hello {{member_name}},\nYour membership has expired.\nPlease contact us to renew your membership.',
    description: 'Alert when membership has lapsed',
  },
];

const queueFilters = ['All', 'Sent', 'Pending', 'Failed', 'Renewal', 'Invoice', 'Expired'] as const;
type QueueFilter = (typeof queueFilters)[number];

export default function SMSDashboardPage() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<{
    todaySent: number;
    monthlySent: number;
    failed: number;
    pending: number;
    renewalRemindersSent: number;
    deviceStatus: string;
    lastSync: string | null;
  } | null>(null);
  const [device, setDevice] = useState<{
    id: string;
    name: string;
    device_model: string;
    android_version: string;
    sim_number: string;
    battery_percentage: number;
    signal_strength: string;
    last_heartbeat: string;
    is_mock?: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('All');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<{ name: string; text: string } | null>(null);

  const [sendMemberId, setSendMemberId] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendTemplateKey, setSendTemplateKey] = useState('Custom');
  const [sendMessage, setSendMessage] = useState('');
  const [sendingManual, setSendingManual] = useState(false);
  const [sendModalError, setSendModalError] = useState<string | null>(null);
  const [sendModalSuccess, setSendModalSuccess] = useState<string | null>(null);

  const [bulkTargetGroup, setBulkTargetGroup] = useState<'All' | 'Active' | 'Expired' | 'Inactive'>('All');
  const [bulkTemplateKey, setBulkTemplateKey] = useState('Welcome');
  const [bulkMessage, setBulkMessage] = useState(builtInTemplates[0].text);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const [customTemplates, setCustomTemplates] = useState<{ name: string; text: string }[]>([]);
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedTemplateName, setCopiedTemplateName] = useState<string | null>(null);
  const [sendingMemberId, setSendingMemberId] = useState<string | null>(null);

  async function loadData() {
    try {
      const [logsData, statsData, deviceData, membersData] = await Promise.all([
        getSMSLogs(),
        getSMSStats(),
        getSMSDevice(),
        getMembers().catch(() => []),
      ]);
      setLogs(logsData);
      setStats(statsData);
      setDevice(deviceData);
      setMembers(membersData);
    } catch (err) {
      console.error('Failed to load SMS Communication Hub data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const saved = localStorage.getItem('fusionfit_custom_templates');
    if (saved) {
      try {
        setCustomTemplates(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getTemplateTextByKey = (key: string) => {
    if (key === 'Custom') return '';
    const builtIn = builtInTemplates.find((t) => t.key === key);
    if (builtIn) return builtIn.text;
    const custom = customTemplates.find((t) => t.name === key);
    return custom ? custom.text : '';
  };

  const handleSendTemplateChange = (key: string, selectedMemId = sendMemberId) => {
    setSendTemplateKey(key);
    const rawText = getTemplateTextByKey(key);
    if (key === 'Custom') {
      setSendMessage('');
      return;
    }
    const selectedMember = members.find((m) => m.id === selectedMemId);
    if (!selectedMember) {
      setSendMessage(rawText);
      return;
    }
    const rendered = rawText
      .replace(/{{\s*member_name\s*}}/g, selectedMember.full_name)
      .replace(/{{\s*days_left\s*}}/g, '3')
      .replace(/{{\s*expiry_date\s*}}/g, selectedMember.package_end_date ? formatDate(selectedMember.package_end_date) : 'N/A')
      .replace(/{{\s*invoice_number\s*}}/g, 'INV-001')
      .replace(/{{\s*amount\s*}}/g, String(selectedMember.package_price ?? '0'));
    setSendMessage(rendered);
  };

  const handleSendMemberChange = (memberId: string) => {
    setSendMemberId(memberId);
    const selectedMember = members.find((m) => m.id === memberId);
    if (selectedMember) {
      setSendPhone(selectedMember.phone || '');
      if (sendTemplateKey !== 'Custom') {
        handleSendTemplateChange(sendTemplateKey, memberId);
      }
    } else {
      setSendPhone('');
    }
  };

  const openSendWithTemplate = (templateKey: string) => {
    setSendTemplateKey(templateKey);
    setSendMessage(getTemplateTextByKey(templateKey));
    setIsSendModalOpen(true);
  };

  const handleSendSMSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendPhone || !sendMessage) {
      setSendModalError('Phone number and message text are required.');
      return;
    }
    setSendingManual(true);
    setSendModalError(null);
    setSendModalSuccess(null);
    try {
      const res = await sendSMSAction(
        sendMemberId || null,
        sendPhone,
        sendMessage,
        sendTemplateKey === 'Custom' ? 'Custom Communication' : sendTemplateKey
      );
      if (res.success) {
        setSendModalSuccess('SMS successfully added to the dispatch queue.');
        setSendMessage('');
        setSendPhone('');
        setSendMemberId('');
        setSendTemplateKey('Custom');
        loadData();
        setTimeout(() => {
          setIsSendModalOpen(false);
          setSendModalSuccess(null);
        }, 2000);
      } else {
        setSendModalError(res.message);
      }
    } catch (err: unknown) {
      setSendModalError(err instanceof Error ? err.message : 'Failed to trigger SMS.');
    } finally {
      setSendingManual(false);
    }
  };

  const handleQuickMemberSMS = async (member: Member, templateKey: string) => {
    if (!member.phone) return;
    setSendingMemberId(member.id);
    const rawText = getTemplateTextByKey(templateKey === 'ExpiryWarning' ? 'Renewal' : templateKey);
    const message = rawText
      .replace(/{{\s*member_name\s*}}/g, member.full_name)
      .replace(/{{\s*expiry_date\s*}}/g, member.package_end_date ? formatDate(member.package_end_date) : 'N/A')
      .replace(/{{\s*days_left\s*}}/g, String(getDaysUntilExpiry(member.package_end_date)));
    const messageType = templateKey === 'ExpiryWarning' ? `Expiry Warning (${getDaysUntilExpiry(member.package_end_date)} days)` : templateKey;
    try {
      await sendSMSAction(member.id, member.phone, message, messageType);
      loadData();
    } finally {
      setSendingMemberId(null);
    }
  };

  const handleBulkSMSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMessage) {
      setBulkError('Template body is required.');
      return;
    }
    setSendingBulk(true);
    setBulkError(null);
    setBulkSuccess(null);
    try {
      const targets = members
        .filter((m) => (bulkTargetGroup === 'All' ? true : m.status === bulkTargetGroup))
        .filter((m) => !!m.phone)
        .map((m) => ({ memberId: m.id, phone: m.phone!, name: m.full_name }));
      if (targets.length === 0) {
        setBulkError(`No members found in the "${bulkTargetGroup}" category with a phone number.`);
        setSendingBulk(false);
        return;
      }
      const res = await sendBulkSMSAction(
        targets,
        bulkMessage,
        bulkTemplateKey === 'Custom' ? 'Bulk Communication' : bulkTemplateKey
      );
      if (res.success) {
        setBulkSuccess(`Successfully queued ${res.count} messages.`);
        loadData();
        setTimeout(() => {
          setIsBulkModalOpen(false);
          setBulkSuccess(null);
        }, 2000);
      } else {
        setBulkError(res.error || 'Failed to dispatch bulk queue.');
      }
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : 'Failed to dispatch bulk SMS.');
    } finally {
      setSendingBulk(false);
    }
  };

  const handleTestSMS = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testConnectionAction();
      setTestResult(res);
      loadData();
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unexpected test SMS failure.',
      });
    } finally {
      setTestingConnection(false);
    }
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
    setTemplateSuccess(editingTemplateName ? 'Template updated successfully.' : 'Custom template created.');
    setTimeout(() => {
      setTemplateSuccess(null);
      setIsCreateTemplateModalOpen(false);
    }, 2000);
  };

  const handleDeleteCustomTemplate = (name: string) => {
    const updated = customTemplates.filter((t) => t.name !== name);
    setCustomTemplates(updated);
    localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
  };

  const handleCopyTemplate = (name: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplateName(name);
    setTimeout(() => setCopiedTemplateName(null), 2000);
  };

  const handleRetry = async (logId: string) => {
    setActionLoadingId(logId);
    try {
      const res = await retrySMSAction(logId);
      if (!res.success) alert(res.message);
      loadData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('Remove this message from the queue?')) return;
    setActionLoadingId(logId);
    try {
      const res = await deleteSMSAction(logId);
      if (!res.success) alert(res.message);
      loadData();
    } finally {
      setActionLoadingId(null);
    }
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
    const activeWithPhone = members.filter((m) => m.status === 'Active' && m.phone && m.package_end_date);
    return {
      today: activeWithPhone.filter((m) => getDaysUntilExpiry(m.package_end_date) === 0),
      threeDays: activeWithPhone.filter((m) => getDaysUntilExpiry(m.package_end_date) === 3),
      sevenDays: activeWithPhone.filter((m) => getDaysUntilExpiry(m.package_end_date) === 7),
    };
  }, [members]);

  const activityTimeline = useMemo(() => {
    return logs
      .filter((l) => l.status === 'Sent')
      .slice(0, 12)
      .map((log) => {
        const type = log.message_type || log.sms_type || 'SMS';
        const name = log.member?.full_name || 'Member';
        let label = `SMS Sent to ${name}`;
        if (type.includes('Renewal') || type.includes('Expiry')) label = `Renewal Reminder Sent to ${name}`;
        else if (type === 'Invoice') label = `Invoice SMS Sent to ${name}`;
        else if (type === 'Expired') label = `Membership Expiry Reminder Sent to ${name}`;
        else if (type === 'Welcome') label = `Welcome SMS Sent to ${name}`;
        const time = log.sent_at || log.created_at;
        return { id: log.id, label, time };
      });
  }, [logs]);

  const searchText = searchQuery.toLowerCase();
  const filtered = logs.filter((log) => {
    const memberName = log?.member?.full_name || '';
    const phone = log?.phone_number || log?.phone || '';
    const msgType = (log?.message_type || log?.sms_type || '').toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      memberName.toLowerCase().includes(searchText) ||
      phone.includes(searchQuery);

    let matchesFilter = true;
    if (queueFilter === 'Sent') matchesFilter = log.status === 'Sent';
    else if (queueFilter === 'Pending') matchesFilter = log.status === 'Pending';
    else if (queueFilter === 'Failed') matchesFilter = log.status === 'Failed';
    else if (queueFilter === 'Renewal')
      matchesFilter = msgType.includes('renewal') || msgType.includes('expiry');
    else if (queueFilter === 'Invoice') matchesFilter = msgType.includes('invoice');
    else if (queueFilter === 'Expired') matchesFilter = msgType === 'expired';

    return matchesSearch && matchesFilter;
  });

  if (loading) return <LoadingSpinner size={40} />;

  const lastHeartbeatDate = device?.last_heartbeat ? new Date(device.last_heartbeat) : null;
  const isOnline = stats?.deviceStatus === 'Online';
  const todayTrendUp = (stats?.todaySent ?? 0) >= yesterdaySent;

  const kpiCards = stats
    ? [
        {
          label: 'SMS Sent Today',
          value: stats.todaySent,
          icon: Send,
          accent: 'from-amber-500/10 to-amber-600/5',
          iconColor: 'text-amber-600',
          trend: todayTrendUp,
        },
        {
          label: 'SMS Sent This Month',
          value: stats.monthlySent,
          icon: Calendar,
          accent: 'from-blue-500/10 to-blue-600/5',
          iconColor: 'text-blue-600',
        },
        {
          label: 'Pending Messages',
          value: stats.pending,
          icon: Clock,
          accent: 'from-yellow-500/10 to-yellow-600/5',
          iconColor: 'text-yellow-600',
        },
        {
          label: 'Failed Messages',
          value: stats.failed,
          icon: XCircle,
          accent: 'from-red-500/10 to-red-600/5',
          iconColor: 'text-red-500',
        },
        {
          label: 'Renewal Reminders Sent',
          value: stats.renewalRemindersSent,
          icon: Bell,
          accent: 'from-violet-500/10 to-violet-600/5',
          iconColor: 'text-violet-600',
        },
        {
          label: 'Active Device Status',
          value: stats.deviceStatus,
          icon: isOnline ? Wifi : XCircle,
          accent: isOnline ? 'from-emerald-500/10 to-emerald-600/5' : 'from-red-500/10 to-red-600/5',
          iconColor: isOnline ? 'text-emerald-600' : 'text-red-500',
          isStatus: true,
        },
      ]
    : [];

  const notificationSections = [
    { key: 'today', title: 'Membership Expiring Today', members: expiringGroups.today, urgent: true },
    { key: 'threeDays', title: 'Membership Expiring in 3 Days', members: expiringGroups.threeDays, urgent: false },
    { key: 'sevenDays', title: 'Membership Expiring in 7 Days', members: expiringGroups.sevenDays, urgent: false },
  ] as const;

  return (
    <div className="page page-enter">
      <PageHeader
        title="SMS Communication Hub"
        subtitle="Manage member reminders, renewal notifications, invoice alerts, and SMS delivery activity from a single dashboard."
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary shadow-md hover:shadow-lg transition-all duration-200"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            Refresh Dashboard
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {kpiCards.map(({ label, value, icon: Icon, accent, iconColor, trend, isStatus }) => (
          <article
            key={label}
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md',
              'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl'
            )}
          >
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60', accent)} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
                <div className={cn('rounded-lg bg-white/80 p-1.5 shadow-sm', iconColor)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              {isStatus ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold',
                    isOnline
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                  {value}
                </span>
              ) : (
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
                      {trend ? 'Up' : '—'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* Quick Actions */}
      <section className="mb-6 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-amber-50/30 p-5 shadow-md">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Zap className="h-4 w-4 text-amber-500" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Send SMS', icon: Send, primary: true, onClick: () => setIsSendModalOpen(true) },
            { label: 'Send Bulk SMS', icon: Users, onClick: () => setIsBulkModalOpen(true) },
            { label: 'Send Renewal Reminder', icon: Bell, onClick: () => openSendWithTemplate('Renewal') },
            { label: 'Send Invoice SMS', icon: CreditCard, onClick: () => openSendWithTemplate('Invoice') },
            { label: 'Create Template', icon: Plus, onClick: () => { setEditingTemplateName(null); setIsCreateTemplateModalOpen(true); } },
            { label: 'Test SMS', icon: PhoneCall, onClick: () => void handleTestSMS(), loading: testingConnection },
          ].map(({ label, icon: Icon, primary, onClick, loading: btnLoading }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              disabled={btnLoading}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-bold transition-all duration-200',
                'hover:-translate-y-0.5 hover:shadow-lg',
                primary
                  ? 'btn-primary border-amber-400 shadow-md'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/50'
              )}
            >
              {btnLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className={cn('h-5 w-5', primary ? '' : 'text-amber-600')} />}
              <span className="leading-tight">{label}</span>
            </button>
          ))}
        </div>
        {testResult && (
          <div
            className={cn(
              'mt-4 flex items-start gap-2.5 rounded-xl border p-4 text-xs font-semibold animate-enter',
              testResult.success
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            )}
          >
            {testResult.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            )}
            <div>
              <p className="font-bold">{testResult.success ? 'Test SMS Queued' : 'Test Failed'}</p>
              <p className="mt-0.5 font-normal text-slate-600">{testResult.message}</p>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Column */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Smart Member Notifications */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Smart Member Notifications
            </h3>
            <div className="flex flex-col gap-5">
              {notificationSections.map(({ key, title, members: groupMembers, urgent }) => (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between">
                    <h4
                      className={cn(
                        'text-xs font-bold uppercase tracking-wider',
                        urgent ? 'text-red-600' : 'text-slate-500'
                      )}
                    >
                      {title}
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {groupMembers.length}
                      </span>
                    </h4>
                  </div>
                  {groupMembers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-xs text-slate-400">
                      No members in this category.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groupMembers.slice(0, 5).map((member) => {
                        const daysLeft = getDaysUntilExpiry(member.package_end_date);
                        return (
                          <div
                            key={member.id}
                            className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition-colors hover:border-amber-200 hover:bg-amber-50/30 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{member.full_name}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span
                                  className={cn(
                                    'font-bold',
                                    daysLeft === 0 ? 'text-red-600' : 'text-amber-600'
                                  )}
                                >
                                  {daysLeft === 0 ? 'Expires today' : `${daysLeft} days remaining`}
                                </span>
                                <span className="font-mono">{member.phone}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={sendingMemberId === member.id}
                              onClick={() => void handleQuickMemberSMS(member, 'ExpiryWarning')}
                              className="btn btn-primary btn-sm shrink-0 shadow-sm"
                            >
                              {sendingMemberId === member.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                  Send SMS
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                      {groupMembers.length > 5 && (
                        <p className="text-center text-[10px] text-slate-400">
                          +{groupMembers.length - 5} more members
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Search & Filters + SMS Queue */}
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-md sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="input-with-icon max-w-md w-full">
                  <Search className="h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by member name or phone number..."
                    className="input-field"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {queueFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setQueueFilter(filter)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200',
                        queueFilter === filter
                          ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  SMS Queue
                </h3>
                <span className="text-xs text-slate-400">{filtered.length} messages</span>
              </div>

              {filtered.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<MessageSquare className="h-5 w-5" />}
                    title="No messages in queue"
                    description={
                      logs.length === 0
                        ? 'SMS messages will appear here once notifications are triggered.'
                        : 'No messages match your search or filter.'
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="data-table hidden md:block">
                    <table>
                      <thead>
                        <tr>
                          <th>Member Name</th>
                          <th>Phone Number</th>
                          <th>Message Type</th>
                          <th>Status</th>
                          <th>Created Time</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((log) => {
                          const memberName = log?.member?.full_name || '—';
                          const phone = log?.phone_number || log?.phone || '—';
                          const smsType = log?.message_type || log?.sms_type || '—';
                          const isExpanded = expandedLogId === log.id;
                          const isLoading = actionLoadingId === log.id;
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                              <td>
                                <p className="table-primary">{memberName}</p>
                              </td>
                              <td className="font-mono text-xs text-slate-600">{phone}</td>
                              <td>
                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {smsType}
                                </span>
                              </td>
                              <td>
                                <span className={cn('badge border text-xs font-semibold', statusBadge(log.status))}>
                                  {log.status || 'Pending'}
                                </span>
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
                              <td className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    title="View"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  {log.status === 'Failed' && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs text-amber-600"
                                      disabled={isLoading}
                                      onClick={() => void handleRetry(log.id)}
                                      title="Retry"
                                    >
                                      {isLoading ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                  {(log.status === 'Pending' || log.status === 'Failed') && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs text-red-500"
                                      disabled={isLoading}
                                      onClick={() => void handleDelete(log.id)}
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {expandedLogId && (() => {
                    const currentLog = filtered.find((l) => l.id === expandedLogId);
                    if (!currentLog) return null;
                    return (
                      <div className="border-t border-slate-200 bg-slate-50 p-5 animate-enter">
                        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Message Preview</h4>
                        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm whitespace-pre-line text-slate-800 shadow-sm">
                          {currentLog.message}
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm mt-3"
                          onClick={() => setExpandedLogId(null)}
                        >
                          Close
                        </button>
                      </div>
                    );
                  })()}

                  <div className="data-cards md:hidden">
                    {filtered.map((log) => {
                      const memberName = log?.member?.full_name || '—';
                      const phone = log?.phone_number || log?.phone || '—';
                      const smsType = log?.message_type || log?.sms_type || '—';
                      const isLoading = actionLoadingId === log.id;
                      return (
                        <article key={log.id} className="mobile-record">
                          <div className="mobile-record-header">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{memberName}</p>
                              <p className="font-mono text-xs text-slate-500">{phone}</p>
                              <span className="mt-1 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {smsType}
                              </span>
                            </div>
                            <span className={cn('badge border text-xs', statusBadge(log.status))}>
                              {log.status || 'Pending'}
                            </span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> View
                            </button>
                            {log.status === 'Failed' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                disabled={isLoading}
                                onClick={() => void handleRetry(log.id)}
                              >
                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                              </button>
                            )}
                            {(log.status === 'Pending' || log.status === 'Failed') && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs text-red-500"
                                disabled={isLoading}
                                onClick={() => void handleDelete(log.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                              </button>
                            )}
                          </div>
                          {expandedLogId === log.id && (
                            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs whitespace-pre-line">
                              {log.message}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* SMS Gateway Device */}
          {device && (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md transition-shadow hover:shadow-lg">
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <Phone className="h-4 w-4 text-amber-500" />
                    SMS Gateway Device
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-400">{device.name}</p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                    isOnline
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="flex flex-col gap-3 text-xs">
                {[
                  { label: 'Device Name', value: device.name, icon: Sliders },
                  { label: 'Device Model', value: device.device_model, icon: Sparkles },
                  { label: 'SIM Number', value: device.sim_number, icon: PhoneCall },
                  {
                    label: 'Battery',
                    value: `${device.battery_percentage}%`,
                    icon: Battery,
                    color: device.battery_percentage < 20 ? 'text-red-500' : 'text-emerald-600',
                  },
                  { label: 'Network Status', value: isOnline ? 'Connected' : 'Disconnected', icon: Wifi },
                  {
                    label: 'Last Sync',
                    value: lastHeartbeatDate
                      ? lastHeartbeatDate.toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never',
                    icon: Clock,
                  },
                  { label: 'Signal Strength', value: device.signal_strength, icon: Signal },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 transition-colors hover:bg-slate-100/80"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-500">
                      <Icon className={cn('h-3.5 w-3.5', color || 'text-slate-400')} />
                      {label}
                    </span>
                    <span className="font-bold text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Activity Timeline */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              <ArrowUpRight className="h-4 w-4 text-amber-500" />
              SMS Activity Timeline
            </h3>
            {activityTimeline.length === 0 ? (
              <p className="text-xs text-slate-400">No recent SMS activity.</p>
            ) : (
              <div className="relative flex flex-col gap-0">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />
                {activityTimeline.map((item, idx) => (
                  <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                    <div
                      className={cn(
                        'relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow-sm',
                        idx === 0 ? 'bg-amber-500' : 'bg-slate-300'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-amber-700">
                        {new Date(item.time).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs font-medium text-slate-700 leading-snug">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SMS Templates */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
              <FileText className="h-4 w-4 text-amber-500" />
              SMS Templates
            </h3>
            <div className="flex flex-col gap-3">
              {[...builtInTemplates, ...customTemplates.map((t) => ({ key: t.name, name: t.name, text: t.text, description: 'Custom template', isCustom: true }))].map((tpl) => (
                <div
                  key={tpl.key}
                  className="group rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-3 transition-all duration-200 hover:border-amber-200 hover:shadow-md"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{tpl.name}</p>
                      {'description' in tpl && (
                        <p className="text-[9px] text-slate-400 mt-0.5">{tpl.description}</p>
                      )}
                    </div>
                  </div>
                  <p className="mb-2 line-clamp-2 font-mono text-[10px] leading-relaxed text-slate-500 whitespace-pre-wrap">
                    {tpl.text}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewTemplate({ name: tpl.name, text: tpl.text });
                        setIsPreviewModalOpen(true);
                      }}
                      className="btn btn-ghost btn-xs text-slate-500"
                    >
                      <Eye className="mr-1 h-3 w-3" /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyTemplate(tpl.name, tpl.text)}
                      className="btn btn-ghost btn-xs text-slate-500"
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
                        setIsCreateTemplateModalOpen(true);
                      }}
                      className="btn btn-ghost btn-xs text-slate-500"
                    >
                      <Edit3 className="mr-1 h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const key = 'isCustom' in tpl && tpl.isCustom ? tpl.name : tpl.key;
                        openSendWithTemplate(key);
                      }}
                      className="btn btn-secondary btn-xs"
                    >
                      Use Template
                    </button>
                    {'isCustom' in tpl && tpl.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomTemplate(tpl.name)}
                        className="btn btn-ghost btn-xs text-red-400"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Modal: Send SMS */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSendModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Send className="h-5 w-5 text-amber-500" />
              Send SMS
            </h3>
            <form onSubmit={handleSendSMSSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label" htmlFor="modal_member">Target Member (Optional)</label>
                <select
                  id="modal_member"
                  className="input-field"
                  value={sendMemberId}
                  onChange={(e) => handleSendMemberChange(e.target.value)}
                >
                  <option value="">— Select Member —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label required-mark" htmlFor="modal_phone">Phone Number</label>
                <input
                  id="modal_phone"
                  type="text"
                  placeholder="+919876543210"
                  className="input-field"
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label" htmlFor="modal_template">Template</label>
                <select
                  id="modal_template"
                  className="input-field"
                  value={sendTemplateKey}
                  onChange={(e) => handleSendTemplateChange(e.target.value)}
                >
                  <option value="Custom">Custom Text</option>
                  <optgroup label="Built-in Templates">
                    {builtInTemplates.map((t) => (
                      <option key={t.key} value={t.key}>{t.name}</option>
                    ))}
                  </optgroup>
                  {customTemplates.length > 0 && (
                    <optgroup label="Custom Templates">
                      {customTemplates.map((t) => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="field-label required-mark" htmlFor="modal_msg">Message Content</label>
                <textarea
                  id="modal_msg"
                  className="input-field min-h-24 resize-y text-sm"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  required
                />
              </div>
              {sendModalError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {sendModalError}
                </div>
              )}
              {sendModalSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {sendModalSuccess}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setIsSendModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={sendingManual} className="btn btn-primary">
                  {sendingManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Queue SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk SMS */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Users className="h-5 w-5 text-amber-500" />
              Send Bulk SMS
            </h3>
            <form onSubmit={handleBulkSMSSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label" htmlFor="bulk_group">Target Group</label>
                <select
                  id="bulk_group"
                  className="input-field"
                  value={bulkTargetGroup}
                  onChange={(e) => setBulkTargetGroup(e.target.value as typeof bulkTargetGroup)}
                >
                  <option value="All">All Members ({members.length})</option>
                  <option value="Active">Active ({members.filter((m) => m.status === 'Active').length})</option>
                  <option value="Expired">Expired ({members.filter((m) => m.status === 'Expired').length})</option>
                  <option value="Inactive">Inactive ({members.filter((m) => m.status === 'Inactive').length})</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="bulk_template">Template</label>
                <select
                  id="bulk_template"
                  className="input-field"
                  value={bulkTemplateKey}
                  onChange={(e) => {
                    setBulkTemplateKey(e.target.value);
                    setBulkMessage(getTemplateTextByKey(e.target.value));
                  }}
                >
                  {builtInTemplates.map((t) => (
                    <option key={t.key} value={t.key}>{t.name}</option>
                  ))}
                  {customTemplates.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                  <option value="Custom">Custom Text</option>
                </select>
              </div>
              <div>
                <label className="field-label required-mark" htmlFor="bulk_msg">Message</label>
                <textarea
                  id="bulk_msg"
                  className="input-field min-h-24 resize-y text-sm"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  required
                />
                <span className="mt-1 block text-[10px] text-slate-400">
                  <Info className="mr-1 inline h-3.5 w-3.5" />
                  Use {'{{member_name}}'} for dynamic names.
                </span>
              </div>
              {bulkError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {bulkError}
                </div>
              )}
              {bulkSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {bulkSuccess}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBulkModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={sendingBulk} className="btn btn-primary">
                  {sendingBulk ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
                  Queue Bulk SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Template */}
      {isCreateTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateTemplateModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Plus className="h-5 w-5 text-amber-500" />
              {editingTemplateName ? 'Edit Template' : 'Create Template'}
            </h3>
            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
              <div>
                <label className="field-label required-mark" htmlFor="new_tpl_name">Template Name</label>
                <input
                  id="new_tpl_name"
                  type="text"
                  className="input-field"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label required-mark" htmlFor="new_tpl_text">Template Body</label>
                <textarea
                  id="new_tpl_text"
                  className="input-field min-h-24 resize-y text-sm"
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                  required
                />
              </div>
              {templateSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {templateSuccess}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateTemplateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTemplateName ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Template Preview */}
      {isPreviewModalOpen && previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPreviewModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-md overflow-hidden border border-slate-200 bg-white p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Eye className="h-5 w-5 text-amber-500" />
              {previewTemplate.name}
            </h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm whitespace-pre-line text-slate-800 leading-relaxed">
              {previewTemplate.text}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn btn-secondary" onClick={() => setIsPreviewModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
