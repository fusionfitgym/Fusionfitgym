'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  Link2,
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
  Phone,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Sliders,
  SendHorizontal,
  Info,
} from 'lucide-react';
import { EmptyState, LoadingSpinner } from '@/components/ui/Primitives';
import {
  dismissSMSAction,
  duplicateSMSAction,
  getSMSLogs,
  getSMSStats,
  markInvoiceNotificationSent,
  markSMSAsSentAction,
  queueSMSNotificationAction,
  resendSMSAction,
  updateSMSMessageAction,
} from '@/lib/actions/sms';
import { getMembers } from '@/lib/actions/members';
import { ensureInvoiceToken, getInvoices, regenerateInvoiceToken } from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { openNativeSms, renderSmsTemplate } from '@/lib/native-sms';
import { buildInvoicePublicUrl, buildInvoiceSmsMessage } from '@/lib/invoice-links';
import { SMSLog, Member, Invoice } from '@/types';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

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

interface SMSTemplate {
  key: string;
  name: string;
  text: string;
  isCustom?: boolean;
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
    text: 'Hi {{member_name}},\nYour FusionFit Gym invoice is ready.\nInvoice No: {{invoice_number}}\nAmount: ₹{{amount}}\nView Invoice:\n{{invoice_link}}\nThank you.\n- FusionFit Gym',
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
  const [stats, setStats] = useState<any | null>(null);

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

  // Accordion SMS Templates: only one template expanded at a time
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>('Welcome');

  // Collapsible Smart Notification cards
  const [notificationsExpanded, setNotificationsExpanded] = useState<Record<string, boolean>>({
    today: true,
    threeDays: false,
    sevenDays: false,
  });

  // FAB menu expand
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);

  // Compose/Send SMS Modal Wizard
  const [composeModal, setComposeModal] = useState<{
    isOpen: boolean;
    templateType: string;
    memberId: string;
    phone: string;
    message: string;
  } | null>(null);

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
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, string>>({});
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

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

      const links: Record<string, string> = {};
      await Promise.all(
        (invoicesData as Invoice[]).slice(0, 30).map(async (inv) => {
          try {
            const token = inv.invoice_token || (await ensureInvoiceToken(inv.id));
            links[inv.id] = buildInvoicePublicUrl(token);
          } catch {
            /* skip */
          }
        })
      );
      setInvoiceLinks(links);
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
      invoice_link: extra.invoice_link || '',
    });
  };

  const buildInvoiceMessage = (inv: Invoice, memberName: string) => {
    const link = invoiceLinks[inv.id] || '';
    return buildInvoiceSmsMessage({
      memberName,
      invoiceNumber: inv.invoice_number,
      amount: inv.amount,
      invoiceLink: link,
    });
  };

  const handleCopyLink = (invoiceId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedLinkId(invoiceId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  };

  const handleRegenerateLink = async (invoiceId: string) => {
    setActionLoadingId(invoiceId);
    try {
      const token = await regenerateInvoiceToken(invoiceId);
      const link = buildInvoicePublicUrl(token);
      setInvoiceLinks((prev) => ({ ...prev, [invoiceId]: link }));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownloadInvoicePdf = async (inv: Invoice) => {
    setActionLoadingId(inv.id);
    try {
      const settings = await getSettings();
      const { generateInvoicePDF } = await import('@/lib/pdf/generateInvoice');
      const member = members.find((m) => m.id === inv.member_id) || inv.member;
      await generateInvoicePDF({ ...inv, member: member as Invoice['member'] }, settings);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setActionLoadingId(null);
    }
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

  const expiringGroups = useMemo(() => {
    const active = members.filter((m) => m.status === 'Active' && m.phone && m.package_end_date && m.duration !== 'Daily Pass');
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

  // Open Compose SMS modal with auto-loaded values
  const openComposeWizard = (type: string) => {
    setIsFabMenuOpen(false);
    const firstMem = members[0];
    if (!firstMem) {
      alert('No members available to draft message.');
      return;
    }
    
    let templateKey = 'Welcome';
    if (type.includes('Renewal')) templateKey = 'Renewal';
    else if (type.includes('Invoice')) templateKey = 'Invoice';
    else if (type.includes('Custom')) templateKey = 'Custom';

    // Auto-calculate message
    const phone = firstMem.phone || '';
    let extra: any = {};
    if (templateKey === 'Invoice') {
      const pendingInv = invoices.find(i => i.member_id === firstMem.id && i.status !== 'Paid');
      if (pendingInv) {
        extra = {
          invoice_number: pendingInv.invoice_number,
          amount: String(pendingInv.amount),
          invoice_link: invoiceLinks[pendingInv.id] || '',
        };
      }
    }
    const message = templateKey === 'Custom' 
      ? `Hello ${firstMem.full_name},\n`
      : buildMemberMessage(firstMem, templateKey, extra);

    setComposeModal({
      isOpen: true,
      templateType: templateKey,
      memberId: firstMem.id,
      phone,
      message,
    });
  };

  // Handle changes in Compose Wizard
  const handleComposeFieldChange = (tplType: string, mId: string, customMsg?: string) => {
    const selectedMem = members.find(m => m.id === mId);
    if (!selectedMem) return;
    const phone = selectedMem.phone || '';
    
    let message = '';
    if (tplType === 'Custom') {
      message = customMsg !== undefined ? customMsg : `Hello ${selectedMem.full_name},\n`;
    } else {
      let extra: any = {};
      if (tplType === 'Invoice') {
        const pendingInv = invoices.find(i => i.member_id === mId && i.status !== 'Paid');
        if (pendingInv) {
          extra = {
            invoice_number: pendingInv.invoice_number,
            amount: String(pendingInv.amount),
            invoice_link: invoiceLinks[pendingInv.id] || '',
          };
        }
      }
      message = buildMemberMessage(selectedMem, tplType, extra);
    }

    setComposeModal({
      isOpen: true,
      templateType: tplType,
      memberId: mId,
      phone,
      message,
    });
  };

  // Submit Compose Wizard
  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeModal) return;
    const { phone, message, memberId, templateType } = composeModal;
    if (!phone || !message) {
      alert('Phone and Message fields are required.');
      return;
    }
    setComposeModal(null);
    await handleNativeSend(phone, message, undefined, memberId, templateType);
  };

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Trigger Send All reminders for a group
  const handleSendAllGroup = async (groupMembers: Member[], templateKey: string, typeName: string) => {
    if (groupMembers.length === 0) return;
    if (!confirm(`Are you sure you want to open and queue native SMS alerts for all ${groupMembers.length} members?`)) return;

    for (const member of groupMembers) {
      const pendingLog = findPendingLog(member.id, typeName.split(' ')[0]);
      const message = pendingLog?.message || buildMemberMessage(member, templateKey, { days_left: String(getDaysUntilExpiry(member.package_end_date)) });
      await handleNativeSend(member.phone, message, pendingLog?.id, member.id, typeName);
    }
  };

  if (loading) return <LoadingSpinner size={40} />;

  // Smart stats calculation
  const totalSent = stats?.todaySent ?? 0;
  const pendingCount = pendingQueue.length;
  const failedCount = stats?.failed ?? 0;
  const totalQueue = stats?.pending ?? 0;

  const templatesList: SMSTemplate[] = [
    ...builtInTemplates.map((t) => ({ ...t, isCustom: false })),
    ...customTemplates.map((t) => ({ ...t, key: t.name, isCustom: true })),
  ];

  return (
    <div className="page page-enter pb-20 select-none text-slate-800">
      
      {/* 1. Compact Sticky Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md shadow-sm">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
            <Smartphone className="h-5 w-5 text-amber-500" /> SMS Hub
          </h1>
          <p className="text-[10px] text-slate-500">Manage member notifications and reminders</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/60 text-slate-600 hover:text-slate-800 transition-all active:scale-95"
          title="Refresh Hub"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </button>
      </header>

      <main className="p-4 space-y-5 max-w-4xl mx-auto">
        
        {/* Device Status banner */}
        {stats && (
          <div className="card p-4 flex flex-row items-center justify-between shadow-sm bg-white border border-slate-200">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Status</h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold",
                  stats.deviceStatus === 'Online' 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", stats.deviceStatus === 'Online' ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                  {stats.deviceStatus === 'Online' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-500 font-medium">
              <span className="block text-slate-400">Last Heartbeat:</span>
              <span className="font-semibold text-slate-700 mt-0.5 block">
                {stats.lastSync ? formatDate(stats.lastSync) : 'Never'}
              </span>
            </div>
          </div>
        )}

        {/* 2. Statistics Grid */}
        <section className="grid grid-cols-2 gap-3.5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-24 transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sent Today</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">{totalSent}</p>
          </div>
          
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-24 transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pending</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">{pendingCount}</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-24 transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Failed</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <XCircle className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">{failedCount}</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-24 transition-all hover:shadow-md hover:border-slate-300">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Queue</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                <Inbox className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900 mt-2">{totalQueue}</p>
          </div>
        </section>

        {/* 3. Quick Actions Section */}
        <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => openComposeWizard('Invoice')}
              className="btn btn-primary py-3 w-full font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" /> Send Invoice
            </button>
            <button
              type="button"
              onClick={() => openComposeWizard('Renewal')}
              className="btn btn-primary py-3 w-full font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Send Renewal
            </button>
            <button
              type="button"
              onClick={() => openComposeWizard('Welcome')}
              className="btn btn-primary py-3 w-full font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> Send Welcome
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('activity-timeline')}
              className="btn btn-secondary py-3 w-full font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4 w-4 text-amber-500" /> View Activity
            </button>
          </div>
        </section>

        {/* 4. Smart Notifications Collapsible Accordions */}
        <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Smart Notifications
          </h2>

          {[
            {
              id: 'today',
              title: 'Membership Expiring Today',
              members: expiringGroups.today,
              template: 'Renewal',
              typeName: 'Renewal',
              urgent: true
            },
            {
              id: 'threeDays',
              title: 'Expiring in 3 Days',
              members: expiringGroups.threeDays,
              template: 'ExpiryWarning',
              typeName: 'Expiry Warning (3 days)',
              urgent: false
            },
            {
              id: 'sevenDays',
              title: 'Expiring in 7 Days',
              members: expiringGroups.sevenDays,
              template: 'ExpiryWarning',
              typeName: 'Expiry Warning (7 days)',
              urgent: false
            }
          ].map((grp) => {
            const isOpen = notificationsExpanded[grp.id];
            return (
              <div key={grp.id} className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setNotificationsExpanded({
                    ...notificationsExpanded,
                    [grp.id]: !isOpen
                  })}
                  className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", grp.urgent ? "bg-red-500 animate-pulse" : "bg-amber-400")} />
                    <span className="text-xs font-bold text-slate-800">{grp.title}</span>
                    <span className="rounded-full bg-amber-100 border border-amber-200/50 px-2 py-0.5 text-[9px] text-amber-800 font-bold">
                      {grp.members.length}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/30 space-y-3.5">
                    {grp.members.length > 0 && (
                      <div className="flex justify-between items-center bg-slate-50/80 border border-slate-200/60 p-2 rounded-lg mt-2">
                        <span className="text-[10px] text-slate-500 font-semibold">Bulk action</span>
                        <button
                          type="button"
                          onClick={() => void handleSendAllGroup(grp.members, grp.template, grp.typeName)}
                          className="btn btn-primary py-1 px-3 text-[10px] rounded-md font-bold flex items-center gap-1"
                        >
                          <SendHorizontal className="h-3 w-3" /> Send All ({grp.members.length})
                        </button>
                      </div>
                    )}
                    {grp.members.length === 0 ? (
                      <p className="text-center text-xs text-slate-450 py-2">No members in this roster.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {grp.members.map((m) => {
                          const pendingLog = findPendingLog(m.id, grp.typeName.split(' ')[0]);
                          const message = pendingLog?.message || buildMemberMessage(m, grp.template, { days_left: String(getDaysUntilExpiry(m.package_end_date)) });
                          return (
                            <div key={m.id} className="bg-white border border-slate-200/80 rounded-xl p-3 flex flex-col gap-3 shadow-sm">
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">{m.full_name}</h4>
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                                  <span className="font-mono">📱 {m.phone}</span>
                                  <span>·</span>
                                  <span>Exp: {formatDate(m.package_end_date)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => void handleDismiss(m.id, grp.id, pendingLog?.id)}
                                  className="btn btn-secondary py-1.5 px-3 text-[10px]"
                                >
                                  Dismiss
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditModal({
                                    logId: pendingLog?.id,
                                    memberId: m.id,
                                    phone: m.phone || '',
                                    message,
                                    messageType: grp.typeName,
                                    title: `Edit — ${m.full_name}`
                                  })}
                                  className="btn btn-secondary py-1.5 px-3 text-[10px]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleNativeSend(m.phone || '', message, pendingLog?.id, m.id, grp.typeName)}
                                  className="btn btn-primary py-1.5 px-3.5 text-[10px] font-bold flex items-center gap-1"
                                >
                                  <SendHorizontal className="h-3 w-3" /> Send SMS
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* 5. Pending SMS Queue (Mobile Cards, Highest Priority) */}
        <section id="pending-queue-section" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Inbox className="h-4 w-4 text-amber-500" /> Pending Queue
            </h2>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px]">{pendingCount} pending</span>
          </div>

          {pendingCount === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6 text-slate-400" />}
              title="Queue is empty"
              description="ERP automations will insert alert logs here when memberships run out or invoices are pending."
            />
          ) : (
            <div className="space-y-3">
              {pendingQueue.map((log) => {
                const phone = log.phone_number || log.phone || '—';
                const smsType = log.message_type || log.sms_type || '—';
                const isLoading = actionLoadingId === log.id;
                
                return (
                  <article key={log.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">{log.member?.full_name || '—'}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="font-mono">📱 {phone}</span>
                          <span>·</span>
                          <span className="font-semibold text-indigo-650 bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.5 rounded">📩 {smsType}</span>
                        </div>
                      </div>
                      <span className="badge border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2">
                        Pending
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-200/60 font-medium leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {log.message}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span>Created today</span>
                      <span>
                        🕒{' '}
                        {log.created_at
                          ? new Date(log.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                             })
                          : '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditModal({
                          logId: log.id,
                          memberId: log.member_id || '',
                          phone,
                          message: log.message,
                          messageType: smsType,
                          title: `Edit message queue`
                        })}
                        className="btn btn-secondary py-2.5 flex-1 font-bold text-xs rounded-xl"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => void handleNativeSend(phone, log.message, log.id, log.member_id, smsType)}
                        className="btn btn-primary py-2.5 flex-[2] font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                      >
                        <SendHorizontal className="h-4 w-4" /> Send SMS
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. Recent SMS Activity (Timeline Layout) */}
        <section id="activity-timeline" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="border-b border-slate-100 pb-3 mb-4 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-amber-500" /> Recent SMS Activity
            </h2>
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-inner">
              <Search className="h-3.5 w-3.5 text-slate-400 ml-1.5" />
              <input
                type="text"
                placeholder="Search member name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-0 outline-none text-xs text-slate-900 placeholder-slate-400 w-full"
              />
            </div>
            
            {/* Horizontal Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {['All', 'Sent', 'Pending', 'Failed'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActivityFilter(f)}
                  className={cn(
                    'rounded-lg border px-3.5 py-1.5 text-[10px] font-bold transition-all shrink-0 active:scale-95',
                    activityFilter === f
                      ? 'border-amber-400 bg-amber-400 text-zinc-950 shadow-sm'
                      : 'border-slate-200 bg-slate-50 text-slate-650 hover:bg-slate-100'
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No activity found" />
          ) : (
            <div className="relative pl-4 border-l border-slate-200 space-y-5 py-2">
              {recentActivity.slice(0, 20).map((log) => {
                const phone = log.phone_number || log.phone || '—';
                const smsType = log.message_type || log.sms_type || '—';
                const isLoading = actionLoadingId === log.id;
                
                return (
                  <article key={log.id} className="relative space-y-1.5">
                    {/* Timeline Node Point */}
                    <span className={cn(
                      "absolute -left-[20.5px] top-1.5 h-3 w-3 rounded-full border border-white shadow-sm",
                      log.status === 'Sent' ? "bg-blue-500" : log.status === 'Failed' ? "bg-red-500" : log.status === 'Skipped' ? "bg-slate-400" : "bg-amber-500"
                    )} />

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        {log.created_at ? formatDate(log.created_at) : '—'}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold border rounded py-0.5 px-2",
                        log.status === 'Sent' 
                          ? 'border-blue-200 bg-blue-50 text-blue-700' 
                          : log.status === 'Failed' 
                          ? 'border-red-200 bg-red-50 text-red-700' 
                          : log.status === 'Skipped'
                          ? 'border-slate-200 bg-slate-100 text-slate-600'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      )}>
                        {log.status === 'Sent' ? 'Opened' : log.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{log.member?.full_name || '—'}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">{smsType} · <span className="font-mono">{phone}</span></p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setPreviewLog(log)}
                        className="btn btn-secondary py-1 px-2.5 text-[9px] font-bold flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> View Details
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          setActionLoadingId(log.id);
                          await resendSMSAction(log.id);
                          setActionLoadingId(null);
                          loadData();
                        }}
                        className="btn btn-secondary py-1 px-2.5 text-[9px] font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Resend
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={async () => {
                          setActionLoadingId(log.id);
                          await duplicateSMSAction(log.id);
                          setActionLoadingId(null);
                          loadData();
                        }}
                        className="btn btn-secondary py-1 px-2.5 text-[9px] font-bold flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" /> Duplicate
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* 7. SMS Templates (Accordion Cards, only one expanded) */}
        <section id="sms-templates" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-500" /> Templates Directory
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingTemplateName(null);
                setNewTemplateName('');
                setNewTemplateText('');
                setIsTemplateModalOpen(true);
              }}
              className="btn btn-secondary py-1.5 px-3 text-[10px] font-bold rounded-lg flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5 text-amber-500" /> Create New
            </button>
          </div>

          <div className="space-y-2.5">
            {templatesList.map((tpl) => {
              const isExpanded = expandedTemplate === tpl.key;
              return (
                <div key={tpl.key} className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedTemplate(isExpanded ? null : tpl.key)}
                    className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-800">{tpl.name}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 space-y-3">
                      <div className="text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {tpl.text}
                      </div>

                      <div className="flex items-center gap-1.5 justify-end">
                        {!!tpl.isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = customTemplates.filter((t) => t.name !== tpl.name);
                              setCustomTemplates(updated);
                              localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
                            }}
                            className="btn btn-secondary py-1.5 px-2.5 text-[10px] font-semibold text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50"
                            title="Delete custom template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewMessage(tpl.text)}
                          className="btn btn-secondary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyTemplate(tpl.name, tpl.text)}
                          className="btn btn-secondary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1"
                        >
                          {copiedTemplateName === tpl.name ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (tpl.isCustom) {
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
                          className="btn btn-primary py-1.5 px-3 text-[10px] font-bold flex items-center gap-1"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3.5 flex items-start gap-1 bg-slate-50 border border-slate-200/65 p-3 rounded-xl">
            <Info className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[9px] leading-normal text-slate-500">
              Personalization tags: {'{{member_name}}'}, {'{{expiry_date}}'}, {'{{amount}}'}, {'{{invoice_number}}'}, {'{{invoice_link}}'}, {'{{days_left}}'}
            </p>
          </div>
        </section>

        {/* 8. Invoice Notifications Cards */}
        <section id="invoice-notif" className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-amber-500" /> Invoice Alerts
            </h2>
            <span className="text-xs text-slate-650 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold">{recentInvoices.length} recent</span>
          </div>

          {recentInvoices.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6 text-slate-400" />}
              title="No recent invoices"
              description="Generating standard packages will register billing logs here."
            />
          ) : (
            <div className="space-y-3">
              {recentInvoices.map((inv) => {
                const member = members.find((m) => m.id === inv.member_id);
                const phone = member?.phone || inv.member?.phone;
                const name = member?.full_name || inv.member?.full_name || 'Member';
                const link = invoiceLinks[inv.id] || '';
                const message = buildInvoiceMessage(inv, name);
                const pendingLog = findPendingLog(inv.member_id, 'Invoice');
                const isLoading = actionLoadingId === inv.id;
                
                return (
                  <article key={inv.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3.5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xs font-bold text-slate-950">{name}</h3>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">{inv.invoice_number} · {inv.created_at ? formatDate(inv.created_at) : '—'}</p>
                      </div>
                      <span className={cn(
                        "badge text-[9px] font-bold uppercase tracking-wide border py-0.5 px-2",
                        inv.status === 'Paid' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      )}>
                        {inv.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-200/60 text-xs">
                      <span className="text-slate-500 font-semibold">Total Amount</span>
                      <span className="text-slate-900 font-extrabold text-sm">{formatCurrency(inv.amount)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!link}
                        onClick={() => link && window.open(link, '_blank')}
                        className="btn btn-secondary py-2.5 flex-1 font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> View Invoice
                      </button>
                      <button
                        type="button"
                        disabled={!phone || isLoading}
                        onClick={() => phone && void handleNativeSend(phone, message, pendingLog?.id, inv.member_id, 'Invoice')}
                        className="btn btn-primary py-2.5 flex-1 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1 shadow-md active:scale-95 transition-all"
                      >
                        <SendHorizontal className="h-3.5 w-3.5" /> Send SMS
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* 9. Bottom Navigation (Mobile Only, Sticky) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 border-t border-slate-200/85 backdrop-blur-md px-2 py-1.5 flex justify-around md:hidden shadow-[0_-8px_24px_rgba(0,0,0,0.03)]">
        {[
          { label: 'Queue', icon: Inbox, id: 'pending-queue-section' },
          { label: 'Activity', icon: MessageSquare, id: 'activity-timeline' },
          { label: 'Templates', icon: FileText, id: 'sms-templates' },
          { label: 'Invoices', icon: FileText, id: 'invoice-notif' },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => scrollToSection(tab.id)}
            className="flex flex-col items-center gap-1.5 text-slate-500 hover:text-amber-600 py-1 transition-all active:scale-90"
          >
            <tab.icon className="h-4.5 w-4.5" />
            <span className="text-[9px] font-bold tracking-wide">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 10. Floating Send Button (FAB) */}
      <div className="fixed bottom-20 right-4 z-40 md:bottom-6">
        {isFabMenuOpen && (
          <div className="absolute bottom-16 right-0 bg-white border border-slate-200/80 rounded-2xl p-2.5 shadow-xl space-y-1.5 w-44 animate-enter">
            {[
              { label: 'Invoice Reminder', type: 'Invoice' },
              { label: 'Renewal Reminder', type: 'Renewal' },
              { label: 'Welcome Message', type: 'Welcome' },
              { label: 'Custom Message', type: 'Custom' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => openComposeWizard(opt.type)}
                className="w-full text-left py-2 px-3 hover:bg-slate-50 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-950 transition-colors"
              >
                • {opt.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 hover:bg-amber-500 text-zinc-950 shadow-lg transition-all active:scale-90 focus:outline-none"
        >
          {isFabMenuOpen ? <X className="h-5 w-5 stroke-[2.5]" /> : <Plus className="h-6 w-6 stroke-[2.5]" />}
        </button>
      </div>

      {/* Compose/Send SMS Modal Wizard */}
      {composeModal && composeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setComposeModal(null)} />
          <div className="card bg-white border border-slate-200 relative z-10 w-full max-w-md p-5 rounded-2xl shadow-xl space-y-4 animate-enter text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <SendHorizontal className="h-4.5 w-4.5 text-amber-500" /> Send New SMS
              </h3>
              <button type="button" onClick={() => setComposeModal(null)} className="text-slate-400 hover:text-slate-650">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="space-y-4 text-slate-800">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Member</label>
                <select
                  value={composeModal.memberId}
                  onChange={(e) => handleComposeFieldChange(composeModal.templateType, e.target.value)}
                  className="input-field w-full text-xs text-slate-800 bg-white border border-slate-200 focus:border-amber-450"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="text-slate-800 bg-white">
                      {m.full_name} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Template Type</label>
                <select
                  value={composeModal.templateType}
                  onChange={(e) => handleComposeFieldChange(e.target.value, composeModal.memberId)}
                  className="input-field w-full text-xs text-slate-800 bg-white border border-slate-200 focus:border-amber-455"
                >
                  <option value="Welcome" className="text-slate-800 bg-white">Welcome Template</option>
                  <option value="Renewal" className="text-slate-800 bg-white">Renewal Reminder</option>
                  <option value="ExpiryWarning" className="text-slate-800 bg-white">Expiry Warning</option>
                  <option value="Payment" className="text-slate-800 bg-white">Payment Reminder</option>
                  <option value="Invoice" className="text-slate-800 bg-white">Invoice Notification</option>
                  <option value="Custom" className="text-slate-800 bg-white">Custom Message</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile Phone</label>
                <input
                  type="text"
                  value={composeModal.phone}
                  onChange={(e) => setComposeModal({ ...composeModal, phone: e.target.value })}
                  className="input-field w-full text-xs text-slate-800 bg-white border border-slate-200 focus:border-amber-450"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Personalized Message</label>
                <textarea
                  value={composeModal.message}
                  onChange={(e) => handleComposeFieldChange(composeModal.templateType, composeModal.memberId, e.target.value)}
                  className="input-field w-full min-h-28 text-xs text-slate-800 bg-white border border-slate-200 focus:border-amber-450 resize-none whitespace-pre-wrap leading-relaxed"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  className="btn btn-secondary py-2 px-4 text-xs font-semibold"
                  onClick={() => setComposeModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  <SendHorizontal className="h-3.5 w-3.5" /> Queue & Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="card bg-white border border-slate-200 relative z-10 w-full max-w-lg p-5 rounded-2xl shadow-xl animate-enter text-slate-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Edit3 className="h-4.5 w-4.5 text-amber-500" />
              {editModal.title}
            </h3>
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              <textarea
                className="input-field bg-white border border-slate-200 text-slate-800 min-h-32 resize-none text-xs leading-relaxed w-full"
                value={editModal.message}
                onChange={(e) => setEditModal({ ...editModal, message: e.target.value })}
                required
              />
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setEditModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsTemplateModalOpen(false)} />
          <div className="card bg-white border border-slate-200 relative z-10 w-full max-w-lg p-5 rounded-2xl shadow-xl animate-enter text-slate-900">
            <h3 className="mb-4 text-sm font-bold text-slate-900">
              {editingTemplateName ? 'Edit Template' : 'Create Custom Template'}
            </h3>
            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
              <input
                className="input-field bg-white border border-slate-200 text-slate-800 text-xs w-full"
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                required
              />
              <textarea
                className="input-field bg-white border border-slate-200 text-slate-800 min-h-28 resize-none text-xs leading-relaxed w-full"
                placeholder="Message body with {{variables}}"
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                required
              />
              {templateSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-250 bg-emerald-50 p-3 text-xs text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {templateSuccess}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" className="btn btn-secondary text-xs" onClick={() => setIsTemplateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs font-bold">
                  Save Template
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
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => {
              setPreviewLog(null);
              setPreviewMessage(null);
            }}
          />
          <div className="card bg-white border border-slate-200 relative z-10 w-full max-w-md p-5 rounded-2xl shadow-xl animate-enter text-slate-900">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Eye className="h-4.5 w-4.5 text-amber-500" />
              Message Preview
            </h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs whitespace-pre-line leading-relaxed text-slate-750">
              {previewLog?.message || previewMessage}
            </div>
            {previewLog && previewLog.status === 'Pending' && (
              <button
                type="button"
                className="btn btn-primary mt-4 w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
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
                <SendHorizontal className="h-4 w-4" />
                Send SMS
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary mt-3 w-full py-2.5 text-xs"
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
