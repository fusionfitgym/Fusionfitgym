'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
  Undo2,
} from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
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
  undoSMSSentAction,
  deleteSMSAction,
} from '@/lib/actions/sms';
import { getMembers } from '@/lib/actions/members';
import { ensureInvoiceToken, getInvoices, regenerateInvoiceToken } from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { openNativeSms, renderSmsTemplate } from '@/lib/native-sms';
import { buildInvoicePublicUrl, buildInvoiceSmsMessage } from '@/lib/invoice-links';
import { SMSLog, Member, Invoice } from '@/types';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [stats, setStats] = useState<{
    totalSent: number;
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

  const [isMobile, setIsMobile] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    today: true,
    threeDays: false,
    sevenDays: false,
  });
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>('Welcome');

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

    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openComposeWizard = (type: string) => {
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

    // Determine a unique key for the loading state to avoid duplicate sends
    const loadingKey = logId || (memberId ? `compose-${memberId}` : 'compose-unknown');
    setActionLoadingId(loadingKey);

    try {
      if (!activeLogId && memberId && messageType) {
        const queued = await queueSMSNotificationAction(memberId, phone, message, messageType);
        if (!queued.success) {
          toast.error(queued.message || 'Failed to queue SMS notification.');
          setActionLoadingId(null);
          return;
        }

        const freshLogs = await getSMSLogs();
        setLogs(freshLogs);
        const created = freshLogs.find(
          (l) => l.member_id === memberId && l.status === 'Pending' && l.message === message
        );
        activeLogId = created?.id;
      }

      // Check if phone number is valid
      const cleanPhone = phone?.replace(/\s+/g, '').trim();
      if (!cleanPhone) {
        toast.error('No valid phone number available.');
        setActionLoadingId(null);
        return;
      }

      // Trigger the native SMS application (SMS API)
      const opened = openNativeSms(phone, message);
      if (!opened) {
        toast.error('Failed to open native SMS application.');
        setActionLoadingId(null);
        return;
      }

      if (activeLogId) {
        // Optimistic UI updates
        // 1. Remove from pending queue immediately in UI state
        setLogs((prevLogs) =>
          prevLogs.map((l) =>
            l.id === activeLogId ? { ...l, status: 'Sent' } : l
          )
        );

        // 2. Update dashboard counters immediately
        setStats((prevStats) => {
          if (!prevStats) return prevStats;
          return {
            ...prevStats,
            pending: Math.max(0, prevStats.pending - 1),
            todaySent: prevStats.todaySent + 1,
            totalSent: (prevStats.totalSent ?? 0) + 1,
          };
        });

        // 3. Persist status in database
        const res = await markSMSAsSentAction(activeLogId);
        if (res.success) {
          toast.success('SMS dispatched and member status updated.');
        } else {
          toast.error(res.message || 'Failed to update SMS status in database.');
          // Revert optimistic updates by reloading data
          loadData();
        }
      }
    } catch (err: unknown) {
      console.error('Error in handleNativeSend:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred during dispatch.');
      loadData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResend = async (log: SMSLog) => {
    setActionLoadingId(log.id);
    try {
      const phone = log.phone_number || log.phone || '';
      if (!phone || !phone.trim()) {
        toast.error('No valid phone number available.');
        setActionLoadingId(null);
        return;
      }

      // 1. Trigger native SMS dispatch immediately
      const opened = openNativeSms(phone, log.message);
      if (!opened) {
        toast.error('Failed to open native SMS application.');
        setActionLoadingId(null);
        return;
      }

      // 2. Optimistic UI update: Increment resend_count and update timestamp locally
      setLogs((prevLogs) =>
        prevLogs.map((l) =>
          l.id === log.id
            ? {
              ...l,
              last_resend_at: new Date().toISOString(),
              resend_count: (l.resend_count ?? 0) + 1,
            }
            : l
        )
      );

      // 3. Update database record via server action
      const res = await resendSMSAction(log.id);
      if (res.success) {
        toast.success('SMS resent successfully.');
      } else {
        toast.error(res.message || 'Failed to update resend count in database.');
        loadData();
      }
    } catch (err: unknown) {
      console.error('Error in handleResend:', err);
      toast.error('An unexpected error occurred during resend.');
      loadData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUndo = async (log: SMSLog) => {
    const confirmed = window.confirm("Move this SMS back to Pending?");
    if (!confirmed) return;

    setActionLoadingId(log.id);
    try {
      // 1. Optimistic UI: Update status to Pending
      setLogs((prevLogs) =>
        prevLogs.map((l) =>
          l.id === log.id ? { ...l, status: 'Pending', sent_at: null } : l
        )
      );

      // 2. Optimistic UI: Update counters
      setStats((prevStats) => {
        if (!prevStats) return prevStats;
        return {
          ...prevStats,
          pending: prevStats.pending + 1,
          todaySent: Math.max(0, prevStats.todaySent - 1),
          totalSent: Math.max(0, (prevStats.totalSent ?? 0) - 1),
        };
      });

      // 3. Database update via server action
      const res = await undoSMSSentAction(log.id);
      if (res.success) {
        toast.success('SMS moved back to Pending.');
      } else {
        toast.error(res.message || 'Failed to undo sent status.');
        loadData();
      }
    } catch (err: unknown) {
      console.error('Error in handleUndo:', err);
      toast.error('An unexpected error occurred during undo.');
      loadData();
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (log: SMSLog) => {
    const confirmed = window.confirm("Are you sure you want to delete this SMS record?");
    if (!confirmed) return;

    setActionLoadingId(log.id);
    try {
      // Optimistic UI update
      setLogs((prevLogs) => prevLogs.filter((l) => l.id !== log.id));

      const res = await deleteSMSAction(log.id);
      if (res.success) {
        toast.success(res.message || 'SMS record deleted successfully.');
      } else {
        toast.error(res.message || 'Failed to delete SMS record.');
      }
    } catch (err: unknown) {
      console.error('Error in handleDelete:', err);
      toast.error('An unexpected error occurred during deletion.');
    } finally {
      setActionLoadingId(null);
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
      { label: 'Total SMS Sent', value: stats.totalSent ?? 0, icon: MessageSquare },
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
  ) => {
    if (isMobile) {
      const isOpen = expandedSections[context];
      return (
        <div key={context} className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setExpandedSections({
              ...expandedSections,
              [context]: !isOpen
            })}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", urgent ? "bg-red-500 animate-pulse" : "bg-amber-400")} />
              <span className="text-xs font-bold text-slate-800">{title}</span>
              <span className="rounded-full bg-amber-100 border border-amber-200/50 px-2 py-0.5 text-[9px] text-amber-800 font-bold">
                {groupMembers.length}
              </span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {isOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50/30 space-y-3">
              {groupMembers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-3">No members in this category.</p>
              ) : (
                <div className="space-y-3 mt-2">
                  {groupMembers.map((member) => {
                    const pendingLog = findPendingLog(member.id, messageType.split(' ')[0]);
                    const message =
                      pendingLog?.message || buildMemberMessage(member, templateKey, { days_left: String(getDaysUntilExpiry(member.package_end_date)) });
                    return (
                      <div key={member.id} className="bg-white border border-slate-200/80 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{member.full_name}</h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="font-mono">📱 {member.phone}</span>
                            <span>·</span>
                            <span>Exp: {formatDate(member.package_end_date)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 mt-1">
                          <button
                            type="button"
                            disabled={actionLoadingId === (pendingLog?.id || `compose-${member.id}`)}
                            onClick={() =>
                              void handleNativeSend(
                                member.phone,
                                message,
                                pendingLog?.id,
                                member.id,
                                messageType
                              )
                            }
                            className="btn btn-primary w-full min-h-[48px] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm rounded-xl"
                          >
                            {actionLoadingId === (pendingLog?.id || `compose-${member.id}`) ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            {actionLoadingId === (pendingLog?.id || `compose-${member.id}`) ? 'Sending...' : 'Send SMS'}
                          </button>
                          <div className="flex gap-2">
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
                              className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs rounded-xl"
                            >
                              Edit Message
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDismiss(member.id, context, pendingLog?.id)}
                              className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs text-slate-500 rounded-xl"
                            >
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
          )}
        </div>
      );
    }

    return (
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
                        disabled={actionLoadingId === (pendingLog?.id || `compose-${member.id}`)}
                        onClick={() =>
                          void handleNativeSend(
                            member.phone,
                            message,
                            pendingLog?.id,
                            member.id,
                            messageType
                          )
                        }
                        className="btn btn-primary btn-sm shadow-sm flex items-center gap-1.5"
                      >
                        {actionLoadingId === (pendingLog?.id || `compose-${member.id}`) ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        {actionLoadingId === (pendingLog?.id || `compose-${member.id}`) ? 'Sending...' : 'Send SMS'}
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
  };

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
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-3 2xl:grid-cols-7">
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

      {/* Quick Actions Panel - Visible on mobile only */}
      {isMobile && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-md mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => openComposeWizard('Invoice')}
              className="btn btn-primary w-full min-h-[48px] font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <FileText className="h-4 w-4" /> Send Invoice
            </button>
            <button
              type="button"
              onClick={() => openComposeWizard('Renewal')}
              className="btn btn-primary w-full min-h-[48px] font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Send Renewal
            </button>
            <button
              type="button"
              onClick={() => openComposeWizard('Welcome')}
              className="btn btn-primary w-full min-h-[48px] font-bold text-xs shadow-sm transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" /> Send Welcome
            </button>
          </div>
        </section>
      )}

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
            </div>
          </section>

          {/* Invoice Notifications Panel */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileText className="h-4 w-4 text-amber-500" />
                Invoice Notifications
              </h3>
              <span className="text-xs text-slate-400">{recentInvoices.length} recent</span>
            </div>
            {recentInvoices.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<FileText className="h-5 w-5" />}
                  title="No invoice notifications"
                  description="When invoices are generated, pending SMS notifications with secure links appear here."
                />
              </div>
            ) : (
              <>
                <div className="hidden md:block data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Member Name</th>
                        <th>Invoice Number</th>
                        <th>Amount</th>
                        <th>Invoice Date</th>
                        <th>Payment Status</th>
                        <th>Invoice Link</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.map((inv) => {
                        const member = members.find((m) => m.id === inv.member_id);
                        const phone = member?.phone || inv.member?.phone;
                        const name = member?.full_name || inv.member?.full_name || 'Member';
                        const link = invoiceLinks[inv.id] || '';
                        const message = buildInvoiceMessage(inv, name);
                        const pendingLog = findPendingLog(inv.member_id, 'Invoice');
                        const isLoading = actionLoadingId === inv.id;
                        const isSending = actionLoadingId === (pendingLog?.id || `compose-${inv.member_id}`);
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/80">
                            <td className="table-primary">{name}</td>
                            <td className="font-mono text-xs">{inv.invoice_number}</td>
                            <td className="text-sm font-semibold">{formatCurrency(inv.amount)}</td>
                            <td className="text-xs text-slate-600">
                              {inv.created_at ? formatDate(inv.created_at) : '—'}
                            </td>
                            <td>
                              <span
                                className={cn(
                                  'badge border text-xs',
                                  inv.status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : inv.status === 'Overdue'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                )}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td>
                              {link ? (
                                <a
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="max-w-[140px] truncate text-[10px] font-mono text-amber-700 hover:underline block"
                                >
                                  {link.replace(/^https?:\/\//, '')}
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">Generating…</span>
                              )}
                            </td>
                            <td className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={!phone || isLoading || isSending}
                                  onClick={() =>
                                    phone &&
                                    void handleNativeSend(phone, message, pendingLog?.id, inv.member_id, 'Invoice')
                                  }
                                  className="btn btn-primary btn-xs flex items-center justify-center"
                                  title="Send SMS"
                                >
                                  {isSending ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Send className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={!link}
                                  onClick={() => link && window.open(link, '_blank')}
                                  className="btn btn-ghost btn-xs"
                                  title="Open Invoice"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!link}
                                  onClick={() => link && handleCopyLink(inv.id, link)}
                                  className="btn btn-ghost btn-xs"
                                  title="Copy Link"
                                >
                                  {copiedLinkId === inv.id ? (
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  ) : (
                                    <Link2 className="h-3 w-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => void handleDownloadInvoicePdf(inv)}
                                  className="btn btn-ghost btn-xs"
                                  title="Download PDF"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => void handleRegenerateLink(inv.id)}
                                  className="btn btn-ghost btn-xs"
                                  title="Regenerate Link"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewMessage(message)}
                                  className="btn btn-ghost btn-xs"
                                  title="Preview Message"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={async () => {
                                    setActionLoadingId(inv.id);
                                    await markInvoiceNotificationSent(inv.member_id, inv.invoice_number);
                                    setActionLoadingId(null);
                                    loadData();
                                  }}
                                  className="btn btn-secondary btn-xs"
                                  title="Mark Sent"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3 p-4 md:hidden">
                  {recentInvoices.map((inv) => {
                    const member = members.find((m) => m.id === inv.member_id);
                    const phone = member?.phone || inv.member?.phone;
                    const name = member?.full_name || inv.member?.full_name || 'Member';
                    const link = invoiceLinks[inv.id] || '';
                    const message = buildInvoiceMessage(inv, name);
                    const pendingLog = findPendingLog(inv.member_id, 'Invoice');
                    const isSending = actionLoadingId === (pendingLog?.id || `compose-${inv.member_id}`);
                    return (
                      <article key={inv.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                        <p className="font-semibold text-slate-900">{name}</p>
                        <p className="mt-1 font-mono text-xs text-slate-600">{inv.invoice_number}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>{formatCurrency(inv.amount)}</span>
                          <span>·</span>
                          <span>{inv.created_at ? formatDate(inv.created_at) : '—'}</span>
                          <span>·</span>
                          <span className="font-semibold">{inv.status}</span>
                        </div>
                        {link && (
                          <p className="mt-2 truncate font-mono text-[10px] text-amber-700">{link}</p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!phone || isSending}
                            onClick={() =>
                              phone &&
                              void handleNativeSend(phone, message, pendingLog?.id, inv.member_id, 'Invoice')
                            }
                            className="btn btn-primary btn-sm flex items-center gap-1.5"
                          >
                            {isSending ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            {isSending ? 'Sending...' : 'Send SMS'}
                          </button>
                          <button
                            type="button"
                            disabled={!link}
                            onClick={() => link && window.open(link, '_blank')}
                            className="btn btn-secondary btn-sm"
                          >
                            Open Invoice
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewMessage(message)}
                            className="btn btn-ghost btn-sm"
                          >
                            Preview
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
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
              <>
                <div className="hidden md:block data-table">
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
                                className="btn btn-primary btn-xs flex items-center gap-1"
                              >
                                {isLoading ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                {isLoading ? 'Sending...' : 'Send SMS'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="block md:hidden flex flex-col gap-3 p-4 bg-slate-50/30">
                  {pendingQueue.map((log) => {
                    const phone = log.phone_number || log.phone || '—';
                    const smsType = log.message_type || log.sms_type || '—';
                    const isLoading = actionLoadingId === log.id;
                    return (
                      <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{log.member?.full_name || '—'}</p>
                          <span className={cn('badge border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', statusBadge(log.status))}>
                            {log.status || 'Pending'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <p className="font-mono">📱 {phone}</p>
                          <p className="font-semibold text-indigo-750 bg-indigo-50/50 border border-indigo-100/50 px-1.5 py-0.5 rounded w-max">
                            📩 {smsType}
                          </p>
                        </div>
                        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                          {log.message}
                        </div>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            void handleNativeSend(phone, log.message, log.id, log.member_id, smsType)
                          }
                          className="btn btn-primary w-full min-h-[48px] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm rounded-xl"
                        >
                          {isLoading ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          {isLoading ? 'Sending...' : 'Send SMS'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </>
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
              <>
                <div className="hidden md:block data-table">
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
                            <td className="text-xs text-slate-650">
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
                                  onClick={() => void handleResend(log)}
                                  title="Resend"
                                >
                                  {isLoading ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                {log.status === 'Sent' && (
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    disabled={isLoading}
                                    onClick={() => void handleUndo(log)}
                                    title="Undo"
                                  >
                                    <Undo2 className="h-3.5 w-3.5 text-indigo-600" />
                                  </button>
                                )}
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
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                                  disabled={isLoading}
                                  onClick={() => void handleDelete(log)}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="block md:hidden flex flex-col gap-3 p-4 bg-slate-50/30">
                  {recentActivity.slice(0, 25).map((log) => {
                    const phone = log.phone_number || log.phone || '—';
                    const smsType = log.message_type || log.sms_type || '—';
                    const isLoading = actionLoadingId === log.id;
                    return (
                      <article key={log.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-900">{log.member?.full_name || '—'}</p>
                          <span className={cn('badge border text-[10px] font-bold px-2 py-0.5 rounded-full uppercase', statusBadge(log.status))}>
                            {log.status || '—'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 space-y-1">
                          <p className="font-mono">📱 {phone}</p>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-750 bg-indigo-50/50 border border-indigo-100/50 px-1.5 py-0.5 rounded">
                              📩 {smsType}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {log.created_at ? formatDate(log.created_at) : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-750 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                          {log.message}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs rounded-xl"
                            onClick={() => setPreviewLog(log)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs rounded-xl flex items-center justify-center gap-1"
                            disabled={isLoading}
                            onClick={() => void handleResend(log)}
                          >
                            {isLoading ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            {isLoading ? 'Resending...' : 'Resend'}
                          </button>
                          {log.status === 'Sent' && (
                            <button
                              type="button"
                              className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs rounded-xl flex items-center justify-center gap-1"
                              disabled={isLoading}
                              onClick={() => void handleUndo(log)}
                            >
                              {isLoading ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Undo2 className="h-3.5 w-3.5" />
                              )}
                              {isLoading ? 'Undoing...' : 'Undo'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs rounded-xl"
                            disabled={isLoading}
                            onClick={async () => {
                              setActionLoadingId(log.id);
                              await duplicateSMSAction(log.id);
                              setActionLoadingId(null);
                              loadData();
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary flex-1 min-h-[48px] font-semibold text-xs text-red-600 rounded-xl hover:bg-red-50 hover:text-red-700"
                            disabled={isLoading}
                            onClick={() => void handleDelete(log)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
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
            <div className={cn(
              "flex flex-col gap-3",
              !isMobile && "max-h-[calc(100vh-12rem)] overflow-y-auto"
            )}>
              {[...builtInTemplates, ...customTemplates.map((t) => ({ ...t, key: t.name, isCustom: true }))].map(
                (tpl) => {
                  const isExpanded = !isMobile || expandedTemplate === tpl.key;
                  return (
                    <div
                      key={tpl.key}
                      className={cn(
                        "rounded-xl border border-slate-100 transition-all bg-slate-50/50 hover:border-amber-200 hover:shadow-sm",
                        isMobile && "overflow-hidden bg-white border-slate-200"
                      )}
                    >
                      {isMobile ? (
                        <button
                          type="button"
                          onClick={() => setExpandedTemplate(expandedTemplate === tpl.key ? null : tpl.key)}
                          className="w-full flex items-center justify-between p-3.5 text-left font-bold text-slate-800 text-xs"
                        >
                          <span>{tpl.name}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>
                      ) : (
                        <p className="text-xs font-bold text-slate-800 p-3 pb-0">{tpl.name}</p>
                      )}

                      {isExpanded && (
                        <div className={cn(
                          "p-3 pt-0",
                          isMobile && "p-4 border-t border-slate-100 bg-slate-50/30"
                        )}>
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
                      )}
                    </div>
                  );
                }
              )}
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-400">
              Variables: {'{{member_name}}'}, {'{{expiry_date}}'}, {'{{amount}}'}, {'{{invoice_number}}'}, {'{{invoice_link}}'}, {'{{days_left}}'}
            </p>
          </section>
        </div>
      </div>

      {/* Compose Modal Wizard */}
      {composeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setComposeModal(null)} />
          <div className="card relative z-10 w-full max-w-lg p-6 shadow-2xl animate-enter">
            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
              <Send className="h-5 w-5 text-amber-500" />
              Compose Message
            </h3>
            <form onSubmit={handleComposeSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Member</label>
                <select
                  className="input-field w-full text-sm"
                  value={composeModal.memberId}
                  onChange={(e) => handleComposeFieldChange(composeModal.templateType, e.target.value)}
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.phone || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Template Type</label>
                <select
                  className="input-field w-full text-sm"
                  value={composeModal.templateType}
                  onChange={(e) => handleComposeFieldChange(e.target.value, composeModal.memberId)}
                >
                  <option value="Welcome">Welcome Template</option>
                  <option value="Renewal">Renewal Reminder</option>
                  <option value="ExpiryWarning">Expiry Warning</option>
                  <option value="Invoice">Invoice Notification</option>
                  <option value="Custom">Custom (Blank)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input
                  type="text"
                  className="input-field w-full text-sm"
                  value={composeModal.phone}
                  onChange={(e) => setComposeModal({ ...composeModal, phone: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message Content</label>
                <textarea
                  className="input-field min-h-32 resize-y text-sm w-full"
                  value={composeModal.message}
                  onChange={(e) => setComposeModal({ ...composeModal, message: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setComposeModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex items-center gap-1.5">
                  <Send className="h-4 w-4" /> Send SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
