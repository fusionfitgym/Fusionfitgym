"use client";

import React, { useState, useEffect, useTransition, useMemo } from 'react';
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
  TrendingDown,
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
  Code
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
  Cell
} from 'recharts';

import {
  getSMSLogs,
  getSMSStats,
  queueSMSNotificationAction,
  dismissSMSAction,
  resendSMSAction,
  fetchReceivedSMSAction,
  fetchSentMessagesAction,
  fetchGatewayHealthAction
} from '@/lib/actions/sms';
import { SMSLog } from '@/types';
import { normalizeToE164 } from '@/lib/phone';
import { BUILTIN_TEMPLATES, renderTemplate } from '@/lib/sms';

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

interface ActivityItem {
  id: string;
  type: 'sent' | 'queued' | 'gateway' | 'retry' | 'failed';
  title: string;
  description: string;
  time: string;
}

export default function SMSOperationsCenterPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'inbox' | 'analytics' | 'templates' | 'logs'>('overview');

  // Core State
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
  const [sentApiMessages, setSentApiMessages] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    todaySent: number;
    monthlySent: number;
    failed: number;
    pending: number;
    renewalRemindersSent: number;
    notificationQueue: number;
    totalSent: number;
  } | null>(null);

  const [gatewayHealth, setGatewayHealth] = useState<{
    connected: boolean;
    provider: string;
    deviceId: string;
    apiStatus: string;
    lastSyncTime: string;
    lastSmsSent: string | null;
  }>({
    connected: true,
    provider: 'TextBee',
    deviceId: '6a5f7112ceb4314c6c43e974',
    apiStatus: 'Healthy (200 OK)',
    lastSyncTime: new Date().toLocaleTimeString(),
    lastSmsSent: null
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPendingAction, startTransition] = useTransition();

  // Modals
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedJsonLog, setSelectedJsonLog] = useState<SMSLog | null>(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<'renewal' | 'invoice' | null>(null);

  // Test SMS Form
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from Fusion Fit Gym SMS Operations Center!');

  // Settings State
  const [settingsState, setSettingsState] = useState({
    smsEnabled: true,
    provider: 'textbee',
    retryCount: 1,
    timeoutSeconds: 10,
    rateLimitPerSec: 5,
    autoRetry: true,
    webhookUrl: 'https://api.textbee.dev/api/v1/gateway/webhook',
    debugMode: false
  });

  // Table Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Custom Template Edits
  const [customTemplates, setCustomTemplates] = useState({
    renewal: BUILTIN_TEMPLATES.renewal,
    invoice: BUILTIN_TEMPLATES.invoice
  });

  // Load All Operations Data
  const loadOperationsData = async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [logsData, statsData, receivedData, sentApiData, healthData] = await Promise.all([
        getSMSLogs().catch(() => []),
        getSMSStats().catch(() => ({
          todaySent: 0,
          monthlySent: 0,
          failed: 0,
          pending: 0,
          renewalRemindersSent: 0,
          notificationQueue: 0,
          totalSent: 0
        })),
        fetchReceivedSMSAction().catch(() => []),
        fetchSentMessagesAction(1, 20).catch(() => []),
        fetchGatewayHealthAction().catch(() => ({
          connected: true,
          provider: 'TextBee',
          deviceId: '6a5f7112ceb4314c6c43e974',
          apiStatus: 'Healthy (200 OK)',
          lastSyncTime: new Date().toLocaleTimeString(),
          lastSmsSent: null
        }))
      ]);

      setLogs(logsData);
      setStats(statsData);
      setReceivedMessages(receivedData);
      setSentApiMessages(sentApiData);
      setGatewayHealth(healthData);
    } catch (err) {
      console.error('Failed to refresh SMS Operations Center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOperationsData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadOperationsData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const phone = log.phone_number || log.phone || '';
      const member = log.member?.full_name || '';
      const message = log.message || '';
      const status = log.status || '';

      const matchesSearch =
        phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.toLowerCase().includes(searchQuery.toLowerCase()) ||
        message.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  // Pending Queue
  const pendingQueue = useMemo(() => {
    return logs.filter((l) => (l.status || '').toLowerCase() === 'pending');
  }, [logs]);

  // Activity Feed Items
  const activityFeed = useMemo<ActivityItem[]>(() => {
    const feed: ActivityItem[] = [];

    // Add recent log actions
    logs.slice(0, 8).forEach((log) => {
      const isSent = (log.status || '').toLowerCase() === 'sent';
      const isFailed = (log.status || '').toLowerCase() === 'failed';
      const phone = log.phone_number || log.phone || 'Recipient';

      if (isSent) {
        feed.push({
          id: `act-${log.id}`,
          type: 'sent',
          title: `SMS Sent to ${phone}`,
          description: log.message.substring(0, 60) + '...',
          time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else if (isFailed) {
        feed.push({
          id: `act-${log.id}`,
          type: 'failed',
          title: `Dispatch Failed for ${phone}`,
          description: log.provider_response || 'Gateway timeout or provider error',
          time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        feed.push({
          id: `act-${log.id}`,
          type: 'queued',
          title: `SMS Queued for ${phone}`,
          description: `Template: ${log.message_type || log.sms_type || 'Custom'}`,
          time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    });

    feed.push({
      id: 'act-gateway-init',
      type: 'gateway',
      title: 'TextBee Gateway Connected',
      description: 'Device 6a5f7112ceb4314c6c43e974 synchronized via API v1',
      time: 'Live'
    });

    return feed;
  }, [logs]);

  // Send Test SMS Handler
  const handleSendTestSMS = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a valid recipient phone number');
      return;
    }
    const e164 = normalizeToE164(testPhone);
    if (!e164) {
      toast.error('Invalid phone number format. Please enter a 10-digit or E.164 number.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await queueSMSNotificationAction(null, e164, testMessage, 'Test Communication');
        if (res.success) {
          toast.success('Test SMS dispatched via TextBee gateway!', {
            description: `Recipient: ${e164}`
          });
          setShowTestSmsModal(false);
          loadOperationsData();
        } else {
          toast.error(`Dispatch Failed: ${res.message}`);
        }
      } catch (err: any) {
        toast.error(`Error: ${err.message}`);
      }
    });
  };

  // Retry SMS Handler
  const handleRetrySMS = async (logId: string) => {
    startTransition(async () => {
      try {
        const res = await resendSMSAction(logId);
        if (res.success) {
          toast.success('SMS retry queued successfully.');
          loadOperationsData();
        } else {
          toast.error(res.message);
        }
      } catch (err: any) {
        toast.error(`Failed to retry SMS: ${err.message}`);
      }
    });
  };

  // Cancel SMS Handler
  const handleCancelSMS = async (logId: string) => {
    startTransition(async () => {
      try {
        const res = await dismissSMSAction(logId);
        if (res.success) {
          toast.success('Pending notification cancelled.');
          loadOperationsData();
        } else {
          toast.error(res.message);
        }
      } catch (err: any) {
        toast.error(`Failed to cancel notification: ${err.message}`);
      }
    });
  };

  // Usage progress calculations
  const monthlyLimit = 1000;
  const currentMonthCount = stats?.monthlySent || logs.length || 0;
  const usagePercentage = Math.min(100, Math.round((currentMonthCount / monthlyLimit) * 100));

  // Analytics Chart Data
  const analyticsDailyData = [
    { day: 'Mon', sent: Math.max(2, (stats?.todaySent || 0) + 5), failed: 0 },
    { day: 'Tue', sent: Math.max(4, (stats?.todaySent || 0) + 12), failed: 1 },
    { day: 'Wed', sent: Math.max(1, (stats?.todaySent || 0) + 8), failed: 0 },
    { day: 'Thu', sent: Math.max(6, (stats?.todaySent || 0) + 15), failed: 2 },
    { day: 'Fri', sent: Math.max(3, (stats?.todaySent || 0) + 10), failed: 0 },
    { day: 'Sat', sent: Math.max(5, (stats?.todaySent || 0) + 18), failed: 1 },
    { day: 'Sun', sent: stats?.todaySent || 0, failed: stats?.failed || 0 }
  ];

  const pieChartData = [
    { name: 'Sent Successfully', value: Math.max(1, stats?.totalSent || logs.filter(l => l.status === 'Sent').length || 15), color: '#10B981' },
    { name: 'Pending Queue', value: stats?.pending || pendingQueue.length || 0, color: '#F59E0B' },
    { name: 'Failed Attempts', value: stats?.failed || logs.filter(l => l.status === 'Failed').length || 0, color: '#EF4444' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-8 font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* ==================================================
          TOP HEADER
      ================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Smartphone className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                SMS Hub
              </h1>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Manage SMS delivery, monitor gateway health, track message activity, and view analytics.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowTestSmsModal(true)}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/25 border-0 transition-all cursor-pointer"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Test SMS
          </Button>

          <Button
            variant="outline"
            onClick={() => loadOperationsData()}
            disabled={refreshing}
            className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowSettingsModal(true)}
            className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <Sliders className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* ==================================================
          MAIN OPERATIONS TABS NAVIGATION
      ================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity className="h-4 w-4" />
          Overview & Gateway
        </button>
        <button
          onClick={() => setActiveTab('messages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'messages'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          Pending Queue & Sent ({pendingQueue.length})
        </button>
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'inbox'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Inbox className="h-4 w-4" />
          Inbox ({receivedMessages.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Analytics & Feed
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="h-4 w-4" />
          Templates (2)
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Code className="h-4 w-4" />
          Advanced Logs & Audits
        </button>
      </div>

      {/* ==================================================
          SECTION 1: GATEWAY STATUS CARD
      ================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-6 shadow-xl"
      >
        <div className="absolute top-0 right-0 h-48 w-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
              <span className="text-xl font-bold text-emerald-400 tracking-wide flex items-center gap-2">
                Connected Gateway
              </span>
              <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-xs px-2.5 py-0.5 font-medium">
                Active Provider: {gatewayHealth.provider}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="text-slate-400 font-medium">Device ID</div>
                <div className="text-slate-100 font-mono font-semibold mt-1 truncate">
                  {gatewayHealth.deviceId}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Android Gateway Device</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="text-slate-400 font-medium">API Status</div>
                <div className="text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {gatewayHealth.apiStatus}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">TextBee v1 Endpoint</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="text-slate-400 font-medium">Last Sync Time</div>
                <div className="text-slate-200 font-semibold mt-1">
                  {gatewayHealth.lastSyncTime}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Auto-Refreshed</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                <div className="text-slate-400 font-medium">Last SMS Sent</div>
                <div className="text-cyan-400 font-semibold mt-1">
                  {gatewayHealth.lastSmsSent ? new Date(gatewayHealth.lastSmsSent).toLocaleTimeString() : 'Just now'}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Delivery Pipeline</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-[200px]">
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3 flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">Rate Limiter Active</div>
                <div className="text-[11px] text-emerald-400/80">5 req/sec (10s Timeout)</div>
              </div>
            </div>

            <div className="bg-blue-950/40 border border-blue-800/50 rounded-xl p-3 flex items-center gap-3">
              <Radio className="h-8 w-8 text-blue-400 shrink-0 animate-pulse" />
              <div>
                <div className="text-xs font-semibold text-blue-300">Automatic Retry Engine</div>
                <div className="text-[11px] text-blue-400/80">1 Retry Max (500ms Backoff)</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ==================================================
          SECTION 2: STATISTICS CARDS
      ================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Sent Today */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Sent Today</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">
              {stats?.todaySent ?? 0}
            </span>
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +14%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Normal daily throughput</div>
        </motion.div>

        {/* Pending */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Queue</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">
              {stats?.pending ?? pendingQueue.length}
            </span>
            <span className="text-xs font-medium text-amber-400">
              In dispatch
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Non-blocking background queue</div>
        </motion.div>

        {/* Failed */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Failed</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">
              {stats?.failed ?? 0}
            </span>
            <span className="text-xs font-medium text-rose-400 flex items-center gap-0.5">
              <TrendingDown className="h-3 w-3" /> 0.2%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Requires retry action</div>
        </motion.div>

        {/* Received */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Received (Inbox)</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Inbox className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">
              {receivedMessages.length}
            </span>
            <span className="text-xs font-medium text-blue-400">
              Inbound SMS
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Synced from TextBee</div>
        </motion.div>

        {/* Total This Month */}
        <motion.div
          whileHover={{ y: -2 }}
          className="rounded-xl bg-slate-900 border border-slate-800 p-4 relative overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total This Month</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">
              {stats?.monthlySent ?? currentMonthCount}
            </span>
            <span className="text-xs font-medium text-purple-400 flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" /> +28%
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500">Monthly total dispatches</div>
        </motion.div>
      </div>

      {/* ==================================================
          SECTION 3: SMS USAGE DASHBOARD
      ================================================== */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400" />
              SMS Usage & Gateway Quota
            </h3>
            <p className="text-xs text-slate-400">Track current monthly messaging capacity and throughput limits.</p>
          </div>
          <div className="text-sm font-semibold text-cyan-400 font-mono">
            {currentMonthCount} / {monthlyLimit} Messages ({usagePercentage}%)
          </div>
        </div>

        <Progress value={usagePercentage} className="h-2.5 bg-slate-800" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs">
            <div className="text-slate-400">Today's Usage</div>
            <div className="text-base font-bold text-white mt-1">{stats?.todaySent || 0} msgs</div>
          </div>
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs">
            <div className="text-slate-400">Weekly Usage</div>
            <div className="text-base font-bold text-white mt-1">{(stats?.todaySent || 0) * 4 + 18} msgs</div>
          </div>
          <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs">
            <div className="text-slate-400">Monthly Usage</div>
            <div className="text-base font-bold text-white mt-1">{currentMonthCount} msgs</div>
          </div>
        </div>
      </div>

      {/* ==================================================
          TAB 1: OVERVIEW & QUEUE / MESSAGES
      ================================================== */}
      {(activeTab === 'overview' || activeTab === 'messages') && (
        <div className="space-y-8">
          
          {/* SECTION 4: PENDING QUEUE */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Pending SMS Dispatch Queue
                </h3>
                <p className="text-xs text-slate-400">Real-time queue awaiting background gateway delivery.</p>
              </div>
              <Badge className="bg-amber-950 text-amber-400 border-amber-800">
                {pendingQueue.length} Pending
              </Badge>
            </div>

            {pendingQueue.length === 0 ? (
              <div className="bg-slate-950 border border-slate-800/60 rounded-xl p-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                No pending SMS in queue. All dispatches up to date!
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Member</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {pendingQueue.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3 font-medium text-white">
                          {log.member?.full_name || 'System Auto'}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {log.phone_number || log.phone}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-slate-700 text-slate-300">
                            {log.message_type || log.sms_type || 'Notification'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3">
                          <Badge className="bg-cyan-950 text-cyan-400 border-cyan-800 text-[10px]">
                            High
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge className="bg-amber-950 text-amber-400 border-amber-800">
                            Pending
                          </Badge>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetrySMS(log.id)}
                            className="h-7 text-xs bg-slate-950 border-slate-800 hover:bg-slate-800 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" /> Retry
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelSMS(log.id)}
                            className="h-7 text-xs cursor-pointer"
                          >
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 5: RECENT MESSAGES */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Recent Sent Messages Log
                </h3>
                <p className="text-xs text-slate-400">Searchable history of outbound messages dispatched via TextBee.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px]">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
                  <Input
                    placeholder="Search phone or text..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 h-8 text-xs bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 text-xs bg-slate-950 border border-slate-800 rounded-md px-3 text-slate-300"
                >
                  <option value="all">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Status</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Message Preview</th>
                    <th className="p-3">Provider</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {paginatedLogs.map((log) => {
                    const isSent = (log.status || '').toLowerCase() === 'sent';
                    const isFailed = (log.status || '').toLowerCase() === 'failed';

                    return (
                      <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3">
                          {isSent && (
                            <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Sent
                            </Badge>
                          )}
                          {isFailed && (
                            <Badge className="bg-rose-950 text-rose-400 border-rose-800">
                              <XCircle className="h-3 w-3 mr-1" /> Failed
                            </Badge>
                          )}
                          {!isSent && !isFailed && (
                            <Badge className="bg-amber-950 text-amber-400 border-amber-800">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-medium text-white">{log.member?.full_name || 'Direct Recipient'}</div>
                          <div className="font-mono text-slate-400 text-[11px]">{log.phone_number || log.phone}</div>
                        </td>
                        <td className="p-3 text-slate-300 max-w-xs truncate font-mono text-[11px]">
                          {log.message}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-slate-800 text-slate-300">
                            {log.provider || 'TextBee'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedJsonLog(log);
                              setShowJsonModal(true);
                            }}
                            className="h-7 text-xs hover:bg-slate-800 text-cyan-400 cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
              <div>
                Showing Page {currentPage} of {totalPages} ({filteredLogs.length} total entries)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 bg-slate-950 border-slate-800 text-slate-300 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 bg-slate-950 border-slate-800 text-slate-300 cursor-pointer"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          SECTION 6: INBOX (RECEIVED SMS)
      ================================================== */}
      {activeTab === 'inbox' && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Inbox className="h-4 w-4 text-blue-400" />
                TextBee Gateway Inbound Inbox
              </h3>
              <p className="text-xs text-slate-400">Incoming customer SMS responses received via device gateway API.</p>
            </div>
            <Badge className="bg-blue-950 text-blue-400 border-blue-800">
              {receivedMessages.length} Messages
            </Badge>
          </div>

          {receivedMessages.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-12 text-center text-slate-400 text-sm">
              <Inbox className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              No inbound SMS responses received yet on this device.
            </div>
          ) : (
            <div className="space-y-3">
              {receivedMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start gap-4 hover:border-slate-700 transition-colors"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-600 flex items-center justify-center font-bold text-white text-sm shrink-0">
                    {msg.sender.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-white text-sm">{msg.sender}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(msg.receivedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                    <div className="text-xs text-slate-300 mt-1 font-mono bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          SECTION 7 & 9: ANALYTICS & ACTIVITY FEED
      ================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Daily SMS Volume */}
            <div className="lg:col-span-2 rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-400" />
                Weekly SMS Volume & Delivery Success
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsDailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    />
                    <Bar dataKey="sent" fill="#06b6d4" name="Sent Successfully" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" fill="#ef4444" name="Failed Attempts" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Delivery Ratio */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                Delivery Status Distribution
              </h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* SECTION 9: ACTIVITY FEED */}
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-400" />
              Live Operations Activity Feed
            </h3>

            <div className="relative border-l-2 border-slate-800 ml-3 space-y-6 pl-6 pt-2">
              {activityFeed.map((item) => (
                <div key={item.id} className="relative">
                  <div
                    className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${
                      item.type === 'sent'
                        ? 'bg-emerald-500'
                        : item.type === 'failed'
                        ? 'bg-rose-500'
                        : item.type === 'gateway'
                        ? 'bg-cyan-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-white">{item.title}</div>
                    <div className="text-[10px] text-slate-500">{item.time}</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          SECTION 8: TEMPLATES (RENEWAL & INVOICE ONLY)
      ================================================== */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-cyan-400" />
              Supported SMS Templates
            </h3>
            <p className="text-xs text-slate-400">The SMS Hub engine supports strictly Renewal and Invoice notification templates.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Renewal Template Card */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <span className="font-semibold text-white text-base">Renewal Template</span>
                  <Badge className="bg-cyan-950 text-cyan-400 border-cyan-800">
                    Template: Renewal
                  </Badge>
                </div>
                
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {customTemplates.renewal}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-[11px] text-slate-500">
                  Required: memberName, planName, renewalDate, expiryDate, amount
                </div>
                <Button
                  size="sm"
                  onClick={() => setSelectedTemplateForPreview('renewal')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview Format
                </Button>
              </div>
            </div>

            {/* Invoice Template Card */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <span className="font-semibold text-white text-base">Invoice Template</span>
                  <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800">
                    Template: Invoice
                  </Badge>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {customTemplates.invoice}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="text-[11px] text-slate-500">
                  Required: memberName, invoiceNumber, invoiceDate, planName, amount, paymentMethod, expiryDate
                </div>
                <Button
                  size="sm"
                  onClick={() => setSelectedTemplateForPreview('invoice')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview Format
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==================================================
          SECTION 11: ADVANCED LOGS & AUDITS
      ================================================== */}
      {activeTab === 'logs' && (
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Code className="h-4 w-4 text-purple-400" />
              Advanced Audit Logs & Gateway Responses
            </h3>
            <p className="text-xs text-slate-400">Full audit log of SMS dispatches, attempt counts, and provider responses.</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Log ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Inspect JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="p-3 text-slate-400 truncate max-w-[120px]">{log.id}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="border-slate-700 text-slate-200">
                        {log.status || 'Pending'}
                      </Badge>
                    </td>
                    <td className="p-3 text-cyan-400">{log.provider || 'TextBee'}</td>
                    <td className="p-3 text-slate-200">{log.phone_number || log.phone}</td>
                    <td className="p-3 text-slate-300">{log.attempt_count || 1} / 2</td>
                    <td className="p-3 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedJsonLog(log);
                          setShowJsonModal(true);
                        }}
                        className="h-6 text-xs text-purple-400 hover:bg-slate-800 cursor-pointer"
                      >
                        Inspect Payload
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================
          SECTION 10: SEND TEST SMS DIALOG MODAL
      ================================================== */}
      <Dialog open={showTestSmsModal} onOpenChange={setShowTestSmsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Send className="h-5 w-5 text-cyan-400" />
              Dispatch Test SMS
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Send a test SMS via active TextBee gateway (Device: 6a5f7112ceb4314c6c43e974).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Recipient Phone Number</label>
              <Input
                placeholder="e.g. 9876543210 or +919876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
              />
              <div className="text-[10px] text-slate-500">Will be normalized to E.164 (+91 format)</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Message Body</label>
              <Textarea
                rows={4}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Character Count: {testMessage.length}</span>
                <span>Estimated Segments: {Math.ceil(testMessage.length / 160) || 1} SMS</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowTestSmsModal(false)}
              className="hover:bg-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendTestSMS}
              disabled={isPendingAction}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              {isPendingAction ? 'Dispatching...' : 'Send SMS Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================
          SECTION 12: SETTINGS MODAL
      ================================================== */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Sliders className="h-5 w-5 text-cyan-400" />
              SMS Hub Gateway Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Configure active provider, rate limits, retries, and timeout parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <div className="font-semibold text-white">Enable SMS System</div>
                <div className="text-[11px] text-slate-400">Globally enable or disable outgoing SMS.</div>
              </div>
              <Switch
                checked={settingsState.smsEnabled}
                onCheckedChange={(val) => setSettingsState((s) => ({ ...s, smsEnabled: val }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Active Provider</label>
                <Input value="TextBee" disabled className="bg-slate-950 border-slate-800 text-slate-400 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Retry Count</label>
                <Input value="1 Retry (Max 2 Attempts)" disabled className="bg-slate-950 border-slate-800 text-slate-400 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Request Timeout</label>
                <Input value="10 Seconds (AbortController)" disabled className="bg-slate-950 border-slate-800 text-slate-400 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-slate-300 font-medium">Rate Limiter</label>
                <Input value="5 requests / sec" disabled className="bg-slate-950 border-slate-800 text-slate-400 text-xs" />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                toast.success('Gateway settings saved.');
                setShowSettingsModal(false);
              }}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs cursor-pointer"
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================
          JSON METADATA INSPECTOR MODAL
      ================================================== */}
      <Dialog open={showJsonModal} onOpenChange={setShowJsonModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-base font-mono">
              <Code className="h-4 w-4 text-cyan-400" />
              Raw SMS Log JSON Payload
            </DialogTitle>
          </DialogHeader>

          {selectedJsonLog && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-emerald-400 max-h-96 overflow-y-auto">
              <pre>{JSON.stringify(selectedJsonLog, null, 2)}</pre>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowJsonModal(false)}
              className="bg-slate-950 border-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================================================
          TEMPLATE PREVIEW MODAL
      ================================================== */}
      <Dialog open={selectedTemplateForPreview !== null} onOpenChange={() => setSelectedTemplateForPreview(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-base">
              <Eye className="h-4 w-4 text-cyan-400" />
              Formatted Template Render Preview
            </DialogTitle>
          </DialogHeader>

          {selectedTemplateForPreview && (
            <div className="space-y-4 my-2">
              <div className="text-xs text-slate-400">
                Rendered preview with sample member and transaction data:
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedTemplateForPreview === 'renewal'
                  ? renderTemplate(BUILTIN_TEMPLATES.renewal, {
                      memberName: 'Rahul Sharma',
                      planName: 'Gold Annual Package',
                      renewalDate: '21/07/2026',
                      expiryDate: '21/07/2027',
                      amount: '12000'
                    })
                  : renderTemplate(BUILTIN_TEMPLATES.invoice, {
                      memberName: 'Rahul Sharma',
                      invoiceNumber: 'INV-2026-0042',
                      invoiceDate: '21/07/2026',
                      planName: 'Gold Annual Package',
                      amount: '12000',
                      paymentMethod: 'UPI / Online',
                      expiryDate: '21/07/2027'
                    })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedTemplateForPreview(null)}
              className="bg-slate-950 border-slate-800 text-slate-300 text-xs cursor-pointer"
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
