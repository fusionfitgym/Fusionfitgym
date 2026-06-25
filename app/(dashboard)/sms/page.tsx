'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Phone,
  Battery,
  Wifi,
  Clock,
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  Info,
  Copy,
  Plus,
  Check,
  Loader2,
  PhoneCall,
  Sliders,
} from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { getSMSLogs, getSMSStats, getSMSDevice, sendSMSAction, sendBulkSMSAction, testConnectionAction } from '@/lib/actions/sms';
import { getMembers } from '@/lib/actions/members';
import { SMSLog, Member } from '@/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function SMSLogsPage() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<{
    todaySent: number;
    monthlySent: number;
    failed: number;
    pending: number;
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
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Quick Action Modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState(false);

  // Form State: Send SMS
  const [sendMemberId, setSendMemberId] = useState<string>('');
  const [sendPhone, setSendPhone] = useState<string>('');
  const [sendTemplateKey, setSendTemplateKey] = useState<string>('Custom');
  const [sendMessage, setSendMessage] = useState<string>('');
  const [sendingManual, setSendingManual] = useState(false);
  const [sendModalError, setSendModalError] = useState<string | null>(null);
  const [sendModalSuccess, setSendModalSuccess] = useState<string | null>(null);

  // Form State: Send Bulk SMS
  const [bulkTargetGroup, setBulkTargetGroup] = useState<'All' | 'Active' | 'Expired' | 'Inactive'>('All');
  const [bulkTemplateKey, setBulkTemplateKey] = useState<string>('Welcome');
  const [bulkMessage, setBulkMessage] = useState<string>('Hello {{member_name}},\nWelcome to FusionFit Gym.');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  // Custom templates stored in LocalStorage for persistence/convenience
  const [customTemplates, setCustomTemplates] = useState<{ name: string; text: string }[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  // Connection Test State
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Copied indicator
  const [copiedTemplateName, setCopiedTemplateName] = useState<string | null>(null);

  // Load data
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
      console.error('Failed to load Communication Center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    // Load custom templates from localStorage if available
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

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const handleCopyTemplate = (name: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplateName(name);
    setTimeout(() => setCopiedTemplateName(null), 2000);
  };

  // Built-in templates constant
  const builtInTemplates = [
    {
      key: 'Welcome',
      name: 'Welcome Member',
      text: 'Hello {{member_name}},\nWelcome to FusionFit Gym.',
      description: 'Dispatched to newly registered members'
    },
    {
      key: 'Renewal',
      name: 'Renewal Reminder',
      text: 'Hi {{member_name}},\nYour membership expires on {{expiry_date}}.',
      description: 'Pre-expiry invoice or post-payment update'
    },
    {
      key: 'ExpiryWarning',
      name: 'Expiry Warning',
      text: 'Hi {{member_name}},\nYour membership will expire in {{days_left}} days.',
      description: 'Sent 7 or 3 days before membership ends'
    },
    {
      key: 'Payment',
      name: 'Payment Reminder',
      text: 'Hi {{member_name}},\nYour payment is pending.',
      description: 'Dispatched for unpaid pending invoices'
    },
    {
      key: 'Expired',
      name: 'Membership Expired',
      text: 'Hi {{member_name}},\nYour membership has expired.',
      description: 'Alert when a member shifts to Expired status'
    }
  ];

  // Helper to get raw template text
  const getTemplateTextByKey = (key: string) => {
    if (key === 'Custom') return '';
    const builtIn = builtInTemplates.find(t => t.key === key);
    if (builtIn) return builtIn.text;
    const custom = customTemplates.find(t => t.name === key);
    return custom ? custom.text : '';
  };

  // Triggered when template changes in single Send SMS dialog
  const handleSendTemplateChange = (key: string, selectedMemId = sendMemberId) => {
    setSendTemplateKey(key);
    const rawText = getTemplateTextByKey(key);
    if (key === 'Custom') {
      setSendMessage('');
      return;
    }

    const selectedMember = members.find(m => m.id === selectedMemId);
    if (!selectedMember) {
      setSendMessage(rawText);
      return;
    }

    // Replace variables in UI preview
    let rendered = rawText
      .replace(/{{\s*member_name\s*}}/g, selectedMember.full_name)
      .replace(/{{\s*days_left\s*}}/g, '3')
      .replace(/{{\s*expiry_date\s*}}/g, selectedMember.package_end_date ? formatDate(selectedMember.package_end_date) : 'N/A');

    setSendMessage(rendered);
  };

  // Triggered when member changes in single Send SMS dialog
  const handleSendMemberChange = (memberId: string) => {
    setSendMemberId(memberId);
    const selectedMember = members.find(m => m.id === memberId);
    if (selectedMember) {
      setSendPhone(selectedMember.phone || '');
      // Update template replacement with new member information
      if (sendTemplateKey !== 'Custom') {
        handleSendTemplateChange(sendTemplateKey, memberId);
      }
    } else {
      setSendPhone('');
    }
  };

  // Manual SMS Submit Handler
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
      const selectedMember = members.find(m => m.id === sendMemberId);
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
        // Refresh logs in background
        loadData();
        setTimeout(() => {
          setIsSendModalOpen(false);
          setSendModalSuccess(null);
        }, 2000);
      } else {
        setSendModalError(res.message);
      }
    } catch (err: any) {
      setSendModalError(err?.message || 'Failed to trigger SMS.');
    } finally {
      setSendingManual(false);
    }
  };

  // Bulk SMS Submit Handler
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
      // Filter members based on target group
      const targets = members
        .filter(m => {
          if (bulkTargetGroup === 'All') return true;
          return m.status === bulkTargetGroup;
        })
        .filter(m => !!m.phone)
        .map(m => ({
          memberId: m.id,
          phone: m.phone!,
          name: m.full_name,
        }));

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
        setBulkSuccess(`Successfully queued ${res.count} messages in the Pending queue.`);
        loadData();
        setTimeout(() => {
          setIsBulkModalOpen(false);
          setBulkSuccess(null);
        }, 2000);
      } else {
        setBulkError(res.error || 'Failed to dispatch bulk queue.');
      }
    } catch (err: any) {
      setBulkError(err?.message || 'Failed to dispatch bulk SMS.');
    } finally {
      setSendingBulk(false);
    }
  };

  // Test Connection Action Handler
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await testConnectionAction();
      setTestResult(res);
      loadData();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Unexpected connection test failure.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save custom template locally
  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateText) {
      alert('Template Name and Text are required.');
      return;
    }
    const updated = [...customTemplates, { name: newTemplateName, text: newTemplateText }];
    setCustomTemplates(updated);
    localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setNewTemplateText('');
    setTemplateSuccess('Custom template successfully created.');
    setTimeout(() => {
      setTemplateSuccess(null);
      setIsCreateTemplateModalOpen(false);
    }, 2000);
  };

  // Delete custom template
  const handleDeleteCustomTemplate = (name: string) => {
    const updated = customTemplates.filter(t => t.name !== name);
    setCustomTemplates(updated);
    localStorage.setItem('fusionfit_custom_templates', JSON.stringify(updated));
  };

  // Filter logic
  const searchText = searchQuery.toLowerCase();
  const filtered = logs.filter((log) => {
    const memberName = log?.member?.full_name || '';
    const nameMatch = memberName.toLowerCase().includes(searchText);
    const phoneMatch = (log?.phone_number || log?.phone || '').includes(searchQuery);
    const msgMatch = log.message.toLowerCase().includes(searchText);
    const matchesSearch = searchQuery === '' || nameMatch || phoneMatch || msgMatch;

    const matchesType = typeFilter === 'All' || 
      (log?.message_type || log?.sms_type) === typeFilter ||
      (typeFilter === 'Expiry Warning' && (log?.message_type || log?.sms_type)?.startsWith('Expiry Warning'));

    const matchesStatus = statusFilter === 'All' || log.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const smsTypes = ['All', 'Welcome', 'Renewal', 'Expiry Warning', 'Payment Reminder', 'Expired', 'Test'];
  const smsStatuses = ['All', 'Pending', 'Sent', 'Failed', 'Skipped'];

  if (loading) return <LoadingSpinner size={40} />;

  // Device heartbeat checks
  const lastHeartbeatDate = device?.last_heartbeat ? new Date(device.last_heartbeat) : null;
  const isOnline = stats?.deviceStatus === 'Online';

  return (
    <div className="page page-enter">
      <PageHeader
        title="Communication Center"
        subtitle="Manage all member communications sent through the gym's connected Android phone."
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary shadow-sm hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh center
          </button>
        }
      />

      {/* Top Statistics */}
      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            {
              label: 'Sent Today',
              value: stats.todaySent,
              icon: Send,
              color: 'text-amber-500',
              bg: 'bg-amber-50/70 border-amber-200/50',
            },
            {
              label: 'Sent This Month',
              value: stats.monthlySent,
              icon: Calendar,
              color: 'text-yellow-600',
              bg: 'bg-yellow-50/70 border-yellow-200/50',
            },
            {
              label: 'Failed Messages',
              value: stats.failed,
              icon: XCircle,
              color: 'text-red-500',
              bg: 'bg-red-50/70 border-red-200/50',
            },
            {
              label: 'Pending Queue',
              value: stats.pending,
              icon: MessageSquare,
              color: 'text-blue-500',
              bg: 'bg-blue-50/70 border-blue-200/50',
              desc: 'Sync Agent target queue'
            },
            {
              label: 'Phone Status',
              value: stats.deviceStatus,
              icon: isOnline ? CheckCircle2 : XCircle,
              color: isOnline ? 'text-emerald-500' : 'text-red-500',
              bg: isOnline ? 'bg-emerald-50/70 border-emerald-200/50' : 'bg-red-50/70 border-red-200/50',
              badge: true
            },
            {
              label: 'Last Phone Sync',
              value: stats.lastSync ? new Date(stats.lastSync).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never',
              icon: Clock,
              color: 'text-indigo-500',
              bg: 'bg-indigo-50/70 border-indigo-200/50',
              desc: stats.lastSync ? new Date(stats.lastSync).toLocaleDateString('en-IN') : undefined
            },
          ].map(({ label, value, icon: Icon, color, bg, desc, badge }) => (
            <article key={label} className={cn('card flex flex-col justify-between border p-4 shadow-sm relative overflow-hidden', bg)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{label}</span>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <div className="flex flex-col">
                {badge ? (
                  <span className={cn('inline-flex items-center gap-1.5 w-fit text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 border', 
                    isOnline 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse' 
                      : 'bg-red-100 text-red-800 border-red-200'
                  )}>
                    <span className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-red-500')} />
                    {value}
                  </span>
                ) : (
                  <p className="text-xl font-bold tracking-tight text-slate-900 mt-1">{value}</p>
                )}
                {desc && <span className="text-[9px] text-slate-400 mt-1 block">{desc}</span>}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Quick Actions & Message History */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Quick Actions Card */}
          <section className="card p-5 border border-slate-200/80 shadow-sm relative overflow-hidden bg-gradient-to-r from-slate-50 to-white">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1">
              <Sliders className="h-3.5 w-3.5" />
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setIsSendModalOpen(true)}
                className="btn btn-primary justify-center shadow-sm"
              >
                <Send className="h-4 w-4 mr-2" />
                Send SMS
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="btn btn-secondary justify-center hover:bg-slate-100 transition-colors"
              >
                <Users className="h-4 w-4 mr-2" />
                Send Bulk SMS
              </button>
              <button
                type="button"
                onClick={() => setIsCreateTemplateModalOpen(true)}
                className="btn btn-secondary justify-center hover:bg-slate-100 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </button>
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={testingConnection}
                className="btn btn-secondary justify-center hover:bg-slate-100 transition-colors"
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </button>
            </div>
            {testResult && (
              <div className={cn("mt-4 rounded-xl p-4 text-xs font-semibold border flex items-start gap-2.5 animate-enter", 
                testResult.success 
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                  : "bg-red-50 border-red-200 text-red-800"
              )}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-bold">{testResult.success ? 'Success' : 'Connection Failure'}</p>
                  <p className="font-normal mt-0.5 text-slate-600">{testResult.message}</p>
                </div>
              </div>
            )}
          </section>

          {/* Message History & Logs */}
          <section className="flex flex-col gap-4">
            {/* Filter and Search Bar */}
            <div className="card p-4 sm:p-5 border border-slate-200/80 shadow-sm bg-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="input-with-icon max-w-md w-full">
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Message Type</span>
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery Status</span>
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
            </div>

            {/* Data Table */}
            {filtered.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="No SMS logs found"
                description={logs.length === 0 ? 'SMS logs will appear here once notifications are triggered.' : 'No logs match the selected filter criteria.'}
              />
            ) : (
              <div className="card overflow-hidden border border-slate-200/80 shadow-sm p-0">
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Member</th>
                        <th>Phone Number</th>
                        <th>Message Type</th>
                        <th>Preview</th>
                        <th>Device Used</th>
                        <th>Status</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        const memberName = log?.member?.full_name || "—";
                        const phone = log?.phone_number || log?.phone || "—";
                        const smsType = log?.message_type || log?.sms_type || "—";
                        
                        return (
                          <tr key={log.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => toggleExpandLog(log.id)}>
                            <td className="font-medium text-slate-700 text-xs">
                              {log.created_at ? formatDate(log.created_at) : '—'}
                              <span className="block text-[10px] text-slate-400 mt-0.5">
                                {log.created_at ? new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </td>
                            <td>
                              <p className="table-primary">{memberName}</p>
                              {log.member_id && <span className="text-[10px] text-slate-400 font-mono block mt-0.5">ID: {log.member_id.substring(0, 8)}...</span>}
                            </td>
                            <td className="font-mono text-xs text-slate-600">{phone}</td>
                            <td>
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {smsType}
                              </span>
                            </td>
                            <td className="max-w-xs truncate text-xs text-slate-500">{log.message}</td>
                            <td className="text-slate-600 text-xs font-semibold">
                              {device && !log.provider_response ? device.device_model : 'Android SIM Bridge'}
                            </td>
                            <td>
                              {log.status === 'Sent' && <span className="badge badge-active">Sent</span>}
                              {log.status === 'Failed' && <span className="badge badge-inactive">Failed</span>}
                              {log.status === 'Pending' && <span className="badge badge-pending bg-blue-50 text-blue-700 border-blue-200">Pending</span>}
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

                {/* Expandable Panel for Message Content */}
                {expandedLogId && (
                  (() => {
                    const currentLog = filtered.find(l => l.id === expandedLogId);
                    if (!currentLog) return null;
                    return (
                      <div className="bg-slate-50 border-t border-b border-slate-200 p-5 font-sans animate-enter">
                        <div className="flex flex-col gap-5 md:flex-row md:justify-between">
                          <div className="flex-1">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Message Content</h4>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-sm whitespace-pre-line text-slate-800 leading-relaxed">
                              {currentLog.message}
                            </div>
                          </div>
                          <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Delivery Metrics</h4>
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-2.5 text-xs text-slate-700">
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="text-slate-400 font-semibold">Delivery State:</span>
                                  <span className="font-bold uppercase">{currentLog.status || 'Pending'}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                  <span className="text-slate-400 font-semibold">Recipient:</span>
                                  <span className="font-mono">{currentLog.phone_number || currentLog.phone || '—'}</span>
                                </div>
                                {currentLog.sent_at && (
                                  <div className="flex justify-between border-b border-slate-100 pb-2">
                                    <span className="text-slate-400 font-semibold">Sent At:</span>
                                    <span>{new Date(currentLog.sent_at).toLocaleString('en-IN')}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-400 font-semibold">Sync Method:</span>
                                  <span>Android SIM Bridge</span>
                                </div>
                              </div>
                            </div>
                            {currentLog.provider_response && (
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Diagnostic Log</h4>
                                <div className="bg-zinc-950 text-zinc-300 rounded-xl p-3 font-mono text-[11px] break-all leading-normal max-h-28 overflow-y-auto">
                                  {currentLog.provider_response}
                                </div>
                              </div>
                            )}
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
                  {filtered.map((log) => {
                    const memberName = log?.member?.full_name || "—";
                    const phone = log?.phone_number || log?.phone || "—";
                    const smsType = log?.message_type || log?.sms_type || "—";

                    return (
                      <article key={log.id} className="mobile-record" onClick={() => toggleExpandLog(log.id)}>
                        <div className="mobile-record-header">
                          <div>
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 mb-1">
                              {smsType}
                            </span>
                            <p className="font-semibold text-slate-900 text-sm">{memberName}</p>
                            <p className="font-mono text-xs text-slate-500 mt-0.5">{phone}</p>
                          </div>
                          <div>
                            {log.status === 'Sent' && <span className="badge badge-active">Sent</span>}
                            {log.status === 'Failed' && <span className="badge badge-inactive">Failed</span>}
                            {log.status === 'Pending' && <span className="badge bg-blue-50 text-blue-700 border-blue-200">Pending</span>}
                            {log.status === 'Skipped' && <span className="badge badge-expired">Skipped</span>}
                          </div>
                        </div>
                        <div className="mobile-record-meta text-xs">
                          <div>
                            <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Timestamp</span>
                            <span className="font-semibold text-slate-700">
                              {log.created_at ? `${formatDate(log.created_at)} at ${new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '—'}
                            </span>
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
                            {log.provider_response && (
                              <div>
                                <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px] mb-1">Diagnostic Log</span>
                                <p className="bg-zinc-950 text-zinc-300 rounded-lg p-3 font-mono text-[10px] break-all leading-normal max-h-24 overflow-y-auto">
                                  {log.provider_response}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Connected Device & SMS Templates */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Connected Phone Card */}
          {device && (
            <section className="card border border-slate-200/80 shadow-sm relative overflow-hidden bg-white p-5 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Phone className="h-4 w-4 text-amber-500" />
                    {device.name}
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">Connected Android SMS Bridge</p>
                </div>
                <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border', 
                  isOnline 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-red-50 text-red-700 border-red-200'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              <div className="flex flex-col gap-3 text-xs text-slate-700">
                {[
                  { label: 'Device Model', value: device.device_model, icon: Sliders },
                  { label: 'Android Version', value: device.android_version, icon: Sparkles },
                  { label: 'SIM Number', value: device.sim_number, icon: PhoneCall },
                  { label: 'Battery Percentage', value: `${device.battery_percentage}%`, icon: Battery, color: device.battery_percentage < 20 ? 'text-red-500' : 'text-slate-500' },
                  { label: 'Signal Strength', value: device.signal_strength, icon: Wifi },
                  { label: 'Last Heartbeat', value: lastHeartbeatDate ? lastHeartbeatDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never', icon: Clock },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <Icon className={cn('h-3.5 w-3.5 text-slate-400', color)} />
                      {label}
                    </span>
                    <span className="font-bold text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* SMS Templates Panel */}
          <section className="card border border-slate-200/80 shadow-sm bg-white p-5 flex flex-col">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <FileText className="h-4 w-4 text-amber-500" />
              SMS Templates
            </h3>

            {/* Built-in list */}
            <div className="flex flex-col gap-4">
              {builtInTemplates.map((tpl) => (
                <div key={tpl.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 hover:border-slate-200 transition-colors">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{tpl.name}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{tpl.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyTemplate(tpl.name, tpl.text)}
                        className="btn btn-ghost btn-xs p-1 text-slate-400 hover:text-slate-600"
                        title="Copy to clipboard"
                      >
                        {copiedTemplateName === tpl.name ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSendTemplateKey(tpl.key);
                          setSendMessage(tpl.text);
                          setIsSendModalOpen(true);
                        }}
                        className="btn btn-secondary btn-xs hover:bg-slate-200 py-0.5 px-2 text-[10px]"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-[10.5px] leading-relaxed text-slate-600 whitespace-pre-wrap">
                    {tpl.text}
                  </p>
                </div>
              ))}

              {/* Custom Templates list */}
              {customTemplates.length > 0 && (
                <div className="border-t border-slate-100 pt-4 mt-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Custom Templates</h4>
                  <div className="flex flex-col gap-3">
                    {customTemplates.map((tpl) => (
                      <div key={tpl.name} className="rounded-xl border border-dashed border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{tpl.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopyTemplate(tpl.name, tpl.text)}
                              className="btn btn-ghost btn-xs p-0.5 text-slate-400 hover:text-slate-600"
                            >
                              {copiedTemplateName === tpl.name ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSendTemplateKey(tpl.name);
                                setSendMessage(tpl.text);
                                setIsSendModalOpen(true);
                              }}
                              className="btn btn-secondary btn-xs py-0.5 px-2 text-[10px]"
                            >
                              Use
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomTemplate(tpl.name)}
                              className="btn btn-ghost btn-xs text-red-400 hover:text-red-600 p-0.5 text-[10px] ml-1"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="font-mono text-[10.5px] leading-relaxed text-slate-500 whitespace-pre-wrap">
                          {tpl.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* MODAL: Send SMS */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSendModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-xl animate-enter">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-500" />
              Queue Individual SMS
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
                  {members.map(m => (
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
                  <option value="Custom">Custom Text (No template)</option>
                  <optgroup label="Built-in Templates">
                    {builtInTemplates.map(t => (
                      <option key={t.key} value={t.key}>{t.name}</option>
                    ))}
                  </optgroup>
                  {customTemplates.length > 0 && (
                    <optgroup label="Custom Templates">
                      {customTemplates.map(t => (
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
                  className="input-field min-h-24 resize-y text-sm leading-normal font-sans"
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Hello, type your message..."
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Placeholders will resolve in real time if a template is selected.
                </span>
              </div>

              {sendModalError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  {sendModalError}
                </div>
              )}

              {sendModalSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  {sendModalSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSendModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingManual}
                  className="btn btn-primary"
                >
                  {sendingManual ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Queue SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Send Bulk SMS */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-xl animate-enter">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              Queue Bulk SMS
            </h3>
            <form onSubmit={handleBulkSMSSubmit} className="flex flex-col gap-4">
              
              <div>
                <label className="field-label" htmlFor="bulk_group">Target Membership Status Group</label>
                <select
                  id="bulk_group"
                  className="input-field"
                  value={bulkTargetGroup}
                  onChange={(e) => setBulkTargetGroup(e.target.value as any)}
                >
                  <option value="All">All Members ({members.length})</option>
                  <option value="Active">Active Members ({members.filter(m => m.status === 'Active').length})</option>
                  <option value="Expired">Expired Members ({members.filter(m => m.status === 'Expired').length})</option>
                  <option value="Inactive">Inactive Members ({members.filter(m => m.status === 'Inactive').length})</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Only members with a phone number on file will be queued.
                </span>
              </div>

              <div>
                <label className="field-label" htmlFor="bulk_template">Template Base</label>
                <select
                  id="bulk_template"
                  className="input-field"
                  value={bulkTemplateKey}
                  onChange={(e) => {
                    setBulkTemplateKey(e.target.value);
                    setBulkMessage(getTemplateTextByKey(e.target.value));
                  }}
                >
                  {builtInTemplates.map(t => (
                    <option key={t.key} value={t.key}>{t.name}</option>
                  ))}
                  {customTemplates.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                  <option value="Custom">Custom Text</option>
                </select>
              </div>

              <div>
                <label className="field-label required-mark" htmlFor="bulk_msg">Bulk Template Body</label>
                <textarea
                  id="bulk_msg"
                  className="input-field min-h-24 resize-y text-sm leading-normal font-sans"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Hi {{member_name}}, ..."
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1.5 block leading-normal">
                  <Info className="inline-block h-3.5 w-3.5 mr-1 text-slate-400" />
                  Use <code className="bg-slate-100 font-mono px-1 py-0.5 rounded text-[9.5px]">{"{{member_name}}"}</code> to insert each member's name dynamically.
                </span>
              </div>

              {bulkError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                  {bulkError}
                </div>
              )}

              {bulkSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  {bulkSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsBulkModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingBulk}
                  className="btn btn-primary"
                >
                  {sendingBulk ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Queue Bulk SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Template */}
      {isCreateTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCreateTemplateModalOpen(false)} />
          <div className="card relative z-10 w-full max-w-lg overflow-hidden border border-slate-200 bg-white p-6 shadow-xl animate-enter">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" />
              Create Custom SMS Template
            </h3>
            <form onSubmit={handleCreateTemplate} className="flex flex-col gap-4">
              
              <div>
                <label className="field-label required-mark" htmlFor="new_tpl_name">Template Name</label>
                <input
                  id="new_tpl_name"
                  type="text"
                  placeholder="e.g. Festival Offer"
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
                  className="input-field min-h-24 resize-y text-sm leading-normal font-sans"
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                  placeholder="Hello {{member_name}}, we have a special offer for you!"
                  required
                />
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs leading-normal flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-slate-400" /> Supported Placeholders
                </span>
                <p className="text-slate-600 mt-1">
                  You can use these keys which resolve dynamically when generating messages:
                </p>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <code className="bg-white border border-slate-200 rounded p-1 text-[10px] font-mono text-center">{"{{member_name}}"}</code>
                  <code className="bg-white border border-slate-200 rounded p-1 text-[10px] font-mono text-center">{"{{expiry_date}}"}</code>
                  <code className="bg-white border border-slate-200 rounded p-1 text-[10px] font-mono text-center">{"{{days_left}}"}</code>
                </div>
              </div>

              {templateSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  {templateSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 mt-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateTemplateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
