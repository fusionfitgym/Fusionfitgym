"use client";

import React, { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  Sliders,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  Inbox,
  FileText,
  Copy,
  Zap,
  BarChart3,
  ListFilter,
  Eye,
  RotateCcw,
  Check,
  ShieldCheck,
  Radio,
  Server,
  Layers,
  Code,
  Download,
  Settings,
  Filter,
  Calendar,
  AlertCircle,
  Info,
  CheckSquare,
  Square,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

import {
  getSMSLogsServerAction,
  getSMSAnalyticsAction,
  retrySMSDeliveryAction,
  bulkRetrySMSDeliveryAction,
  cancelSMSAction,
  queueSMSNotificationAction,
  fetchReceivedSMSAction,
  fetchSentMessagesAction,
  fetchGatewayHealthAction
} from '@/lib/actions/sms';

import { getSettings, upsertSettings } from '@/lib/actions/settings';
import { createClient } from '@/lib/supabase/client';
import { SMSLog, SMSFilterParams, SMSAnalyticsStats, SMSAutoRetrySettings } from '@/types';
import { normalizeToE164 } from '@/lib/phone';
import { BUILTIN_TEMPLATES, renderTemplate } from '@/lib/sms-templates';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

const CHART_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

export default function SMSOperationsCenterPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'messages' | 'analytics' | 'inbox'>('messages');

  // Core Data State
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [totalLogs, setTotalLogs] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [analytics, setAnalytics] = useState<SMSAnalyticsStats | null>(null);
  const [gatewayHealth, setGatewayHealth] = useState<any>(null);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [sentApiMessages, setSentApiMessages] = useState<any[]>([]);

  // Filtering & Pagination State
  const [filters, setFilters] = useState<SMSFilterParams>({
    status: 'all',
    messageType: 'all',
    search: '',
    dateRange: 'all',
    page: 1,
    limit: 20
  });

  // UI Interactive State
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPending, startTransition] = useTransition();
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedLogForDrawer, setSelectedLogForDrawer] = useState<SMSLog | null>(null);
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Bulk Retry & Progress
  const [isConfirmBulkModalOpen, setIsConfirmBulkModalOpen] = useState<boolean>(false);
  const [isBulkRetrying, setIsBulkRetrying] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 });

  // Auto-Retry Settings Modal
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [retrySettings, setRetrySettings] = useState<SMSAutoRetrySettings>({
    enabled: true,
    intervalMinutes: 15,
    maxAttempts: 3,
    temporaryOnly: true
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Manual SMS Modal
  const [isComposeModalOpen, setIsComposeModalOpen] = useState<boolean>(false);
  const [composeForm, setComposeForm] = useState({ phone: '', name: '', message: '', type: 'Manual' });
  const [isSendingCompose, setIsSendingCompose] = useState<boolean>(false);

  // JSON Drawer copy feedback
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // 1. Primary Data Loader
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const [logsData, analyticsData, healthData, settingsData] = await Promise.all([
        getSMSLogsServerAction(filters),
        getSMSAnalyticsAction(),
        fetchGatewayHealthAction(),
        getSettings()
      ]);

      setLogs(logsData.logs);
      setTotalLogs(logsData.total);
      setTotalPages(logsData.totalPages);
      setAnalytics(analyticsData);
      setGatewayHealth(healthData);

      setRetrySettings({
        enabled: settingsData.sms_auto_retry_enabled !== 'false',
        intervalMinutes: parseInt(settingsData.sms_auto_retry_interval || '15', 10),
        maxAttempts: parseInt(settingsData.sms_auto_retry_max_attempts || '3', 10),
        temporaryOnly: settingsData.sms_retry_temporary_only !== 'false'
      });
    } catch (err) {
      console.error('Failed to fetch SMS Operations data:', err);
      toast.error('Failed to sync SMS logs. Check network or database connection.');
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load secondary tab data when switched
  useEffect(() => {
    if (activeTab === 'inbox') {
      Promise.all([fetchReceivedSMSAction(), fetchSentMessagesAction()]).then(([inbox, sent]) => {
        setReceivedMessages(inbox || []);
        setSentApiMessages(sent || []);
      });
    }
  }, [activeTab]);

  // 2. Real-time Subscription via Supabase Client
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('sms_delivery_management_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sms_logs' },
        () => {
          console.log('[Realtime] sms_logs change detected. Refetching logs...');
          loadData(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  // 3. Single Retry Action
  const handleSingleRetry = async (logId: string) => {
    setRetryingLogId(logId);
    toast.info('Dispatching SMS retry via TextBee...');
    try {
      const res = await retrySMSDeliveryAction(logId);
      if (res.success) {
        toast.success(res.message);
        if (selectedLogForDrawer && selectedLogForDrawer.id === logId && res.log) {
          setSelectedLogForDrawer(res.log);
        }
      } else {
        toast.error(res.message);
      }
      await loadData(true);
    } catch (err: any) {
      toast.error(`Retry error: ${err?.message || 'Unknown error'}`);
    } finally {
      setRetryingLogId(null);
    }
  };

  // 4. Cancel SMS Action
  const handleCancelSMS = async (logId: string) => {
    try {
      const res = await cancelSMSAction(logId);
      if (res.success) {
        toast.success('Message status set to Cancelled.');
        if (selectedLogForDrawer && selectedLogForDrawer.id === logId) {
          setSelectedLogForDrawer(null);
        }
        await loadData(true);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Failed to cancel: ${err.message}`);
    }
  };

  // 5. Bulk Retry Action Execution
  const handleExecuteBulkRetry = async () => {
    const targetIds = selectedLogIds.length > 0 
      ? selectedLogIds 
      : logs.filter(l => l.status === 'Failed').map(l => l.id);

    if (targetIds.length === 0) {
      toast.warning('No failed messages available for retry.');
      setIsConfirmBulkModalOpen(false);
      return;
    }

    setIsConfirmBulkModalOpen(false);
    setIsBulkRetrying(true);
    setBulkProgress({ completed: 0, total: targetIds.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const id = targetIds[i];
      try {
        const res = await retrySMSDeliveryAction(id);
        if (res.success) succeeded++;
        else failed++;
      } catch {
        failed++;
      }
      setBulkProgress({ completed: i + 1, total: targetIds.length });
    }

    setIsBulkRetrying(false);
    setSelectedLogIds([]);
    toast.success(`Bulk retry finished: ${succeeded} sent successfully, ${failed} failed.`);
    await loadData(true);
  };

  // 6. Save Auto-Retry Settings
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await upsertSettings({
        sms_auto_retry_enabled: String(retrySettings.enabled),
        sms_auto_retry_interval: String(retrySettings.intervalMinutes),
        sms_auto_retry_max_attempts: String(retrySettings.maxAttempts),
        sms_retry_temporary_only: String(retrySettings.temporaryOnly)
      });
      toast.success('SMS Delivery & Auto-Retry settings updated.');
      setIsSettingsModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 7. Manual SMS Send
  const handleSendCompose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.phone || !composeForm.message) {
      toast.error('Recipient phone and message body are required.');
      return;
    }
    setIsSendingCompose(true);
    try {
      const res = await queueSMSNotificationAction(
        null,
        composeForm.phone,
        composeForm.message,
        composeForm.type,
        composeForm.name || undefined
      );
      if (res.success) {
        toast.success('SMS dispatched to gateway queue.');
        setIsComposeModalOpen(false);
        setComposeForm({ phone: '', name: '', message: '', type: 'Manual' });
        await loadData(true);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setIsSendingCompose(false);
    }
  };

  // 8. Export Logs (CSV Generator)
  const handleExportCSV = () => {
    if (!logs || logs.length === 0) {
      toast.warning('No logs available to export.');
      return;
    }

    const headers = [
      'ID',
      'Status',
      'Member Name',
      'Phone Number',
      'Type',
      'Message',
      'HTTP Status',
      'Failure Reason',
      'Failure Category',
      'Retry Count',
      'Created At',
      'TextBee Message ID'
    ];

    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${l.status || ''}"`,
      `"${(l.member_name || l.member?.full_name || 'Member').replace(/"/g, '""')}"`,
      `"${l.phone_number || l.phone || ''}"`,
      `"${l.message_type || l.sms_type || 'General'}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      `"${l.http_status || ''}"`,
      `"${(l.error_message || l.provider_response || '').replace(/"/g, '""')}"`,
      `"${l.failure_category || 'none'}"`,
      `"${l.retry_count ?? 0}"`,
      `"${l.created_at}"`,
      `"${l.textbee_message_id || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fusionfit_sms_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('SMS Logs CSV exported successfully.');
  };

  // Table row select helper
  const toggleSelectAll = () => {
    if (selectedLogIds.length === logs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(logs.map(l => l.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedLogIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Status Color Helper
  const getStatusBadge = (status: string | null) => {
    const s = (status || 'pending').toLowerCase();
    switch (s) {
      case 'sent':
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Sent</Badge>;
      case 'failed':
        return <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Failed</Badge>;
      case 'retrying':
        return <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 flex items-center gap-1.5 animate-pulse"><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Retrying</Badge>;
      case 'sending':
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 animate-pulse" /> Sending</Badge>;
      case 'cancelled':
      case 'skipped':
        return <Badge className="bg-slate-800 text-slate-400 border-slate-700 flex items-center gap-1.5">Cancelled</Badge>;
      default:
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SMS Delivery Management & Retry System
              </h1>
              <p className="text-sm text-slate-400 flex items-center gap-2 mt-0.5">
                <span>TextBee Gateway Integration</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-400 font-medium">Real-Time Sync Active</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsComposeModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <Send className="w-4 h-4 mr-1.5 text-indigo-400" /> Send SMS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-400" /> Export CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsModalOpen(true)}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <Settings className="w-4 h-4 mr-1.5 text-purple-400" /> Auto-Retry Settings
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData()}
            disabled={isLoading}
            className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Prominent Warning Banner if Failed SMS > 0 */}
      {analytics && analytics.failed > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-950/60 via-rose-900/40 to-slate-950 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-rose-200 text-base md:text-lg flex items-center gap-2">
                <span>⚠️ {analytics.failed} Failed SMS Waiting for Retry</span>
              </h3>
              <p className="text-xs md:text-sm text-rose-300/80 mt-0.5">
                {analytics.retryQueueCount} messages are eligible for automatic retry (Temporary gateway timeout/offline failures).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <Button
              size="sm"
              onClick={() => setIsConfirmBulkModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-lg shadow-rose-600/30 border border-rose-400/30"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" /> Retry All Failed ({analytics.failed})
            </Button>
          </div>
        </motion.div>
      )}

      {/* Dashboard Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {/* Sent Today */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Sent Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            {analytics?.todaySent ?? 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Monthly: {analytics?.monthlySent ?? 0}</span>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-500/50" />
        </div>

        {/* Failed */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 relative overflow-hidden group hover:border-rose-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Failed SMS</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-rose-400 mt-2">
            {analytics?.failed ?? 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Requires Retry</span>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-rose-500/50" />
        </div>

        {/* Pending Queue */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Queue</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-amber-400 mt-2">
            {analytics?.pending ?? 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Awaiting Dispatch</span>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-amber-500/50" />
        </div>

        {/* Success Rate */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Success Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-indigo-400 mt-2">
            {analytics?.successRate ?? 100}%
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Delivery Reliability</span>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500/50" />
        </div>

        {/* Retry Queue Count */}
        <div className="col-span-2 lg:col-span-1 rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 relative overflow-hidden group hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Retry Queue</span>
            <RotateCcw className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-sky-400 mt-2">
            {analytics?.retryQueueCount ?? 0}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">Auto-Retry Eligible</span>
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-sky-500/50" />
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'messages'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListFilter className="w-4 h-4" /> SMS Delivery Logs
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Error Analytics & Trends
          </button>

          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'inbox'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" /> TextBee Gateway & Inbox
          </button>
        </div>
      </div>

      {/* ── TAB 1: SMS DELIVERY LOGS ────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          
          {/* Filters & Bulk Action Header Bar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <Input
                  placeholder="Search Member Name, Phone, Message, or Error..."
                  value={filters.search || ''}
                  onChange={e => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                  className="pl-9 bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl"
                />
              </div>

              {/* Filters Group */}
              <div className="flex flex-wrap items-center gap-2.5">
                
                {/* Status Filter */}
                <select
                  value={filters.status || 'all'}
                  onChange={e => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="Sent">Sent (🟢)</option>
                  <option value="Failed">Failed (🔴)</option>
                  <option value="Pending">Pending (🟡)</option>
                  <option value="Retrying">Retrying (🔵)</option>
                  <option value="Cancelled">Cancelled (⚪)</option>
                </select>

                {/* Message Type Filter */}
                <select
                  value={filters.messageType || 'all'}
                  onChange={e => setFilters(prev => ({ ...prev, messageType: e.target.value, page: 1 }))}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Message Types</option>
                  <option value="Welcome">Welcome</option>
                  <option value="Renewal">Renewal Reminder</option>
                  <option value="Invoice">Invoice</option>
                  <option value="Manual">Manual</option>
                  <option value="Payment">Payment</option>
                  <option value="Fee Alert">Fee Alert</option>
                </select>

                {/* Date Range Filter */}
                <select
                  value={filters.dateRange || 'all'}
                  onChange={e => setFilters(prev => ({ ...prev, dateRange: e.target.value as any, page: 1 }))}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>

                {/* Limit */}
                <select
                  value={filters.limit || 20}
                  onChange={e => setFilters(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            {/* Selection Toolbar */}
            {selectedLogIds.length > 0 && (
              <div className="flex items-center justify-between bg-indigo-950/60 border border-indigo-500/40 rounded-xl p-3 text-sm">
                <span className="text-indigo-200 font-medium flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  {selectedLogIds.length} message(s) selected
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsConfirmBulkModalOpen(true)}
                    disabled={isBulkRetrying}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Retry Selected ({selectedLogIds.length})
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLogIds([])}
                    className="border-slate-800 text-slate-300 hover:bg-slate-900"
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}

            {/* Bulk Retry Execution Progress Bar */}
            {isBulkRetrying && (
              <div className="space-y-2 p-3 bg-slate-950 border border-sky-500/30 rounded-xl">
                <div className="flex items-center justify-between text-xs text-sky-300">
                  <span className="font-semibold flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 animate-spin text-sky-400" />
                    Retrying {bulkProgress.completed} / {bulkProgress.total} completed
                  </span>
                  <span>{Math.round((bulkProgress.completed / bulkProgress.total) * 100)}%</span>
                </div>
                <Progress value={(bulkProgress.completed / bulkProgress.total) * 100} className="h-2 bg-slate-900" />
              </div>
            )}
          </div>

          {/* SMS Data Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4 w-10">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-white">
                        {selectedLogIds.length === logs.length && logs.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Recipient</th>
                    <th className="p-4">Phone Number</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Message Preview</th>
                    <th className="p-4">Retry Count</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60">
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={9} className="p-4">
                          <div className="h-6 bg-slate-800/50 rounded-lg w-full" />
                        </td>
                      </tr>
                    ))
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-500">
                        <Inbox className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                        <p className="text-base font-semibold text-slate-300">No SMS logs found</p>
                        <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or date range.</p>
                      </td>
                    </tr>
                  ) : (
                    logs.map(log => {
                      const isSelected = selectedLogIds.includes(log.id);
                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="p-4">
                            <button onClick={() => toggleSelectRow(log.id)} className="text-slate-400 hover:text-white">
                              {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            {getStatusBadge(log.status)}
                          </td>

                          <td className="p-4 font-semibold text-white">
                            {log.member_name || log.member?.full_name || 'Member'}
                          </td>

                          <td className="p-4 font-mono text-xs text-slate-300">
                            {log.phone_number || log.phone || 'N/A'}
                          </td>

                          <td className="p-4 whitespace-nowrap">
                            <Badge variant="outline" className="border-slate-700 bg-slate-950 text-slate-300">
                              {log.message_type || log.sms_type || 'General'}
                            </Badge>
                          </td>

                          <td className="p-4 max-w-xs truncate text-xs text-slate-400" title={log.message}>
                            {log.message}
                          </td>

                          <td className="p-4 whitespace-nowrap text-xs text-center font-mono">
                            <span className={`px-2 py-0.5 rounded-full border ${
                              (log.retry_count ?? 0) > 0
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                : 'bg-slate-950 border-slate-800 text-slate-500'
                            }`}>
                              {log.retry_count ?? log.resend_count ?? 0}
                            </span>
                          </td>

                          <td className="p-4 whitespace-nowrap text-xs text-slate-400 font-mono">
                            {new Date(log.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>

                          <td className="p-4 whitespace-nowrap text-right space-x-1.5">
                            {(log.status === 'Failed' || log.status === 'Pending') && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={retryingLogId === log.id}
                                onClick={() => handleSingleRetry(log.id)}
                                className="h-8 border-slate-800 bg-slate-950 hover:bg-indigo-950/60 hover:text-indigo-300 text-xs"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 mr-1 ${retryingLogId === log.id ? 'animate-spin text-indigo-400' : ''}`} />
                                Retry
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLogForDrawer(log)}
                              className="h-8 text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Details
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-800 bg-slate-950/60 text-xs text-slate-400">
              <div>
                Showing page <span className="font-semibold text-white">{filters.page}</span> of <span className="font-semibold text-white">{totalPages}</span> ({totalLogs} total logs)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page === 1}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                  className="h-8 border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={filters.page === totalPages}
                  onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                  className="h-8 border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-40"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: ERROR ANALYTICS & TRENDS ────────────────────── */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Failure Causes Pie Chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-400" /> Failure Causes Distribution
                </h3>
                <p className="text-xs text-slate-400 mt-1">Classification of failed SMS attempts by gateway error reason</p>
              </div>

              <div className="h-72 w-full">
                {analytics.failureCauses.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    No failure records logged yet. Perfect delivery status! 🎉
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.failureCauses}
                        dataKey="count"
                        nameKey="cause"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={50}
                        paddingAngle={4}
                        label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                      >
                        {analytics.failureCauses.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Daily Trends Bar Chart */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" /> 7-Day Delivery & Failure Trends
                </h3>
                <p className="text-xs text-slate-400 mt-1">Comparison of successfully sent vs failed SMS volume</p>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                    />
                    <Legend />
                    <Bar dataKey="sent" name="Sent (🟢)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="Failed (🔴)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: TEXTBEE GATEWAY & INBOX ──────────────────────── */}
      {activeTab === 'inbox' && (
        <div className="space-y-6">
          {/* Gateway Status Header */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">TextBee Gateway Status</h3>
                <p className="text-xs text-slate-400">Device ID: <code className="text-emerald-400 font-mono">{gatewayHealth?.deviceId || '6a61b347ceb4314c6c6a6835'}</code></p>
              </div>
            </div>

            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 px-3 py-1 text-xs">
              ● {gatewayHealth?.apiStatus || 'Healthy (200 OK)'}
            </Badge>
          </div>

          {/* Inbox Messages Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-400" /> Device Received SMS Inbox
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Sender Phone</th>
                    <th className="p-3">Message Body</th>
                    <th className="p-3">Received Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {receivedMessages.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500 text-xs">
                        No received messages in TextBee inbox.
                      </td>
                    </tr>
                  ) : (
                    receivedMessages.map((msg, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-xs text-indigo-300">{msg.sender}</td>
                        <td className="p-3 text-xs text-slate-300">{msg.message}</td>
                        <td className="p-3 font-mono text-xs text-slate-400">
                          {new Date(msg.receivedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FAILED MESSAGE DETAILS DRAWER (DIALOG / MODAL) ──────── */}
      <Dialog open={!!selectedLogForDrawer} onOpenChange={open => !open && setSelectedLogForDrawer(null)}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                SMS Attempt Details
              </DialogTitle>
              {selectedLogForDrawer && getStatusBadge(selectedLogForDrawer.status)}
            </div>
            <DialogDescription className="text-xs text-slate-400">
              Detailed gateway response payload, failure diagnosis, and retry controls
            </DialogDescription>
          </DialogHeader>

          {selectedLogForDrawer && (
            <div className="space-y-4 pt-2">
              
              {/* Recipient Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Recipient</span>
                  <span className="font-bold text-white text-sm">{selectedLogForDrawer.member_name || 'Member'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Phone</span>
                  <span className="font-mono text-indigo-300">{selectedLogForDrawer.phone_number || selectedLogForDrawer.phone}</span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Message Type</span>
                  <span className="text-slate-300">{selectedLogForDrawer.message_type || selectedLogForDrawer.sms_type || 'General'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Gateway</span>
                  <span className="text-slate-300">{selectedLogForDrawer.gateway || 'TextBee'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-semibold">HTTP Status</span>
                  <span className="font-mono text-amber-400 font-bold">{selectedLogForDrawer.http_status || 'N/A'}</span>
                </div>

                <div>
                  <span className="text-slate-500 block uppercase font-semibold">Category</span>
                  <Badge className={`text-[10px] uppercase ${
                    selectedLogForDrawer.failure_category === 'permanent' ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'
                  }`}>
                    {selectedLogForDrawer.failure_category || 'Temporary'}
                  </Badge>
                </div>
              </div>

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>FULL TEXT MESSAGE</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedLogForDrawer.message);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                      toast.success('Message copied to clipboard.');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" /> {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-xs font-mono text-slate-200 whitespace-pre-wrap">
                  {selectedLogForDrawer.message}
                </div>
              </div>

              {/* Failure Error Reason */}
              {selectedLogForDrawer.error_message && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-3 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-rose-300 block">Failure Reason / Error Message:</span>
                  <p className="text-rose-200 font-mono">{selectedLogForDrawer.error_message}</p>
                </div>
              )}

              {/* Raw TextBee JSON Payload */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase block">Raw TextBee Response Payload (JSON)</span>
                <pre className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(
                    selectedLogForDrawer.provider_metadata || {
                      httpStatus: selectedLogForDrawer.http_status,
                      error: selectedLogForDrawer.error_message,
                      textbee_message_id: selectedLogForDrawer.textbee_message_id
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              {/* Attempt Timeline */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-400">
                <p>Created: <span className="text-slate-200 font-mono">{new Date(selectedLogForDrawer.created_at).toLocaleString()}</span></p>
                {selectedLogForDrawer.last_retry_at && (
                  <p>Last Retry: <span className="text-slate-200 font-mono">{new Date(selectedLogForDrawer.last_retry_at).toLocaleString()}</span></p>
                )}
                <p>Total Attempts: <span className="text-white font-bold">{selectedLogForDrawer.retry_count ?? 0}</span></p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {selectedLogForDrawer && (selectedLogForDrawer.status === 'Failed' || selectedLogForDrawer.status === 'Pending') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCancelSMS(selectedLogForDrawer.id)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Cancel Message
              </Button>
            )}

            {selectedLogForDrawer && (selectedLogForDrawer.status === 'Failed' || selectedLogForDrawer.status === 'Pending') && (
              <Button
                size="sm"
                disabled={retryingLogId === selectedLogForDrawer.id}
                onClick={() => handleSingleRetry(selectedLogForDrawer.id)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg"
              >
                <RotateCcw className={`w-4 h-4 mr-1.5 ${retryingLogId === selectedLogForDrawer.id ? 'animate-spin' : ''}`} />
                Retry Now
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK RETRY CONFIRMATION MODAL ───────────────────────── */}
      <Dialog open={isConfirmBulkModalOpen} onOpenChange={setIsConfirmBulkModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-rose-300">
              <RotateCcw className="w-5 h-5 text-rose-400" />
              Confirm Bulk Retry
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              This will re-dispatch previously failed SMS messages via the TextBee gateway.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-sm text-slate-300 space-y-2">
            <p>
              Are you sure you want to retry{' '}
              <strong className="text-indigo-400 font-bold">
                {selectedLogIds.length > 0 ? selectedLogIds.length : analytics?.failed || 0}
              </strong>{' '}
              failed SMS messages?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Each message will use the exact same recipient phone and text body. Retry counts will be updated.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmBulkModalOpen(false)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleExecuteBulkRetry} className="bg-rose-600 hover:bg-rose-500 text-white font-semibold">
              Start Bulk Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AUTO-RETRY SETTINGS MODAL ───────────────────────────── */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              Auto-Retry Background Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Configure automatic background retry rules for failed SMS notifications
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            {/* Toggle Enable */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold block text-slate-200">Enable Automatic Retry</span>
                <span className="text-xs text-slate-400">Automatically retry failed SMS in background</span>
              </div>
              <Switch
                checked={retrySettings.enabled}
                onCheckedChange={checked => setRetrySettings(prev => ({ ...prev, enabled: checked }))}
              />
            </div>

            {/* Retry Interval */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Retry Interval</label>
              <select
                value={retrySettings.intervalMinutes}
                onChange={e => setRetrySettings(prev => ({ ...prev, intervalMinutes: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-purple-500"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
              </select>
            </div>

            {/* Max Retries */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 font-medium">Maximum Retry Limit</label>
              <select
                value={retrySettings.maxAttempts}
                onChange={e => setRetrySettings(prev => ({ ...prev, maxAttempts: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:ring-1 focus:ring-purple-500"
              >
                <option value={1}>1 Retry Max</option>
                <option value={3}>3 Retries Max</option>
                <option value={5}>5 Retries Max</option>
              </select>
            </div>

            {/* Temporary Failures Only Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
              <div>
                <span className="font-semibold block text-slate-200 text-xs">Retry Temporary Failures Only</span>
                <span className="text-[11px] text-slate-400">Skip permanent failures (e.g. invalid numbers)</span>
              </div>
              <Switch
                checked={retrySettings.temporaryOnly}
                onCheckedChange={checked => setRetrySettings(prev => ({ ...prev, temporaryOnly: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)} className="border-slate-800 text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-purple-600 hover:bg-purple-500 text-white font-semibold">
              {isSavingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COMPOSE SMS MODAL ───────────────────────────────────── */}
      <Dialog open={isComposeModalOpen} onOpenChange={setIsComposeModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-400" />
              Compose Manual SMS
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Dispatch an SMS message to a recipient via TextBee gateway
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendCompose} className="space-y-4 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Member Name (Optional)</label>
              <Input
                placeholder="Rahul Sharma"
                value={composeForm.name}
                onChange={e => setComposeForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-slate-950 border-slate-800 text-white text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Phone Number *</label>
              <Input
                placeholder="+919876543210 or 9876543210"
                value={composeForm.phone}
                onChange={e => setComposeForm(prev => ({ ...prev, phone: e.target.value }))}
                className="bg-slate-950 border-slate-800 text-white text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Message Body *</label>
              <Textarea
                placeholder="Type your message here..."
                rows={4}
                value={composeForm.message}
                onChange={e => setComposeForm(prev => ({ ...prev, message: e.target.value }))}
                className="bg-slate-950 border-slate-800 text-white text-xs"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsComposeModalOpen(false)} className="border-slate-800 text-slate-300">
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingCompose} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                {isSendingCompose ? 'Dispatching...' : 'Send SMS'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
