'use client';

import { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  RefreshCw, 
  ShieldAlert, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  ArrowLeft,
  Activity,
  Check,
  Ban
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader, SectionCard } from '@/components/ui/Primitives';
import { toast } from 'sonner';
import { 
  searchMembersForTesting,
  disableBiometricTest,
  enableBiometricTest,
  queueDisableAction,
  queueEnableAction,
  clearPendingActions,
  getPendingQueue,
  getSyncAgentStatus,
  SearchMemberResult,
  BiometricQueueItem,
  SyncAgentStatus
} from '@/lib/actions/biometric-testing';
import { cn } from '@/lib/utils';

export default function BiometricTestingPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMemberResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionsQueue, setActionsQueue] = useState<BiometricQueueItem[]>([]);
  const [agentStatus, setAgentStatus] = useState<SyncAgentStatus>({
    lastPollTime: null,
    lastCompletedAction: null,
    lastError: null,
    queueSize: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch queue and agent status
  const fetchQueueAndStatus = async (showToast = false) => {
    if (profile?.role !== 'Super Admin') return;
    setRefreshing(true);
    try {
      const [queueData, statusData] = await Promise.all([
        getPendingQueue(),
        getSyncAgentStatus()
      ]);
      setActionsQueue(queueData);
      setAgentStatus(statusData);
      if (showToast) {
        toast.success('Metrics refreshed successfully');
      }
    } catch (err: any) {
      console.error('Error fetching testing metrics:', err);
      toast.error('Failed to load metrics: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Poll every 5 seconds
  useEffect(() => {
    fetchQueueAndStatus();
    const interval = setInterval(fetchQueueAndStatus, 5000);
    return () => clearInterval(interval);
  }, [profile]);

  // Handle Search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchMembersForTesting(searchQuery);
      setSearchResults(results);
      if (results.length === 0) {
        toast.info('No members found matching your search');
      } else {
        toast.success(`Found ${results.length} member(s)`);
      }
    } catch (err: any) {
      toast.error('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Handle Test Actions
  const handleAction = async (actionType: 'disableTest' | 'enableTest' | 'queueDisable' | 'queueEnable', memberId: string) => {
    setProcessingId(`${actionType}-${memberId}`);
    try {
      let res;
      switch (actionType) {
        case 'disableTest':
          res = await disableBiometricTest(memberId);
          break;
        case 'enableTest':
          res = await enableBiometricTest(memberId);
          break;
        case 'queueDisable':
          res = await queueDisableAction(memberId);
          break;
        case 'queueEnable':
          res = await queueEnableAction(memberId);
          break;
      }

      if (res?.success) {
        toast.success('Action executed successfully!');
        // Refresh local search details
        if (searchQuery.trim()) {
          const results = await searchMembersForTesting(searchQuery);
          setSearchResults(results);
        }
        // Force refresh queue
        await fetchQueueAndStatus();
      } else {
        toast.error(res?.error || 'Action execution failed');
      }
    } catch (err: any) {
      toast.error('An error occurred: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Queue Clear
  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to clear all pending actions in the queue? This will cancel unprocessed biometric updates.')) {
      return;
    }
    try {
      const res = await clearPendingActions();
      if (res.success) {
        toast.success('Pending actions queue cleared successfully');
        await fetchQueueAndStatus();
      } else {
        toast.error(res.error || 'Failed to clear queue');
      }
    } catch (err: any) {
      toast.error('Error clearing queue: ' + err.message);
    }
  };

  // Format Helper
  const formatTimeSafe = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Never';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' ' + date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    });
  };

  if (profile?.role !== 'Super Admin') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800">Access Restricted</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Only Super Administrators have access credentials to view the Biometric Testing diagnostic console.
        </p>
        <Link href="/settings" className="btn btn-secondary flex items-center gap-2 mt-2">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="page page-wide page-enter select-none">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-widest mb-1 select-none">
            <Link href="/settings" className="hover:text-amber-700 transition-colors flex items-center gap-1">
              Settings
            </Link>
            <span>/</span>
            <span className="text-slate-400">Developer Tools</span>
          </div>
          <h1 className="page-title text-slate-900 font-extrabold text-2xl tracking-tight">Biometric Testing Console</h1>
          <p className="page-subtitle text-slate-500 text-sm mt-0.5">Diagnose and test the ERP → Sync Agent → device access control cycle safely in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueueAndStatus(true)}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh Diagnostics
          </button>
          <Link href="/settings" className="btn btn-secondary flex items-center gap-2 text-xs font-bold">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
          </Link>
        </div>
      </header>

      {/* Sync Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          {
            title: 'Last Agent Poll',
            value: formatTimeSafe(agentStatus.lastPollTime),
            desc: 'Timestamp of latest pending-actions call',
            icon: <Activity className="h-5 w-5 text-amber-600" />,
            bgColor: 'bg-amber-50/50 border border-amber-200/50'
          },
          {
            title: 'Pending Queue Size',
            value: `${agentStatus.queueSize} action(s)`,
            desc: 'Actions currently waiting for retrieval',
            icon: <Clock className="h-5 w-5 text-blue-600" />,
            bgColor: 'bg-blue-50/50 border border-blue-200/50'
          },
          {
            title: 'Last Completed Action',
            value: agentStatus.lastCompletedAction || 'No actions processed yet',
            desc: 'Latest successful callback report',
            icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
            bgColor: 'bg-emerald-50/50 border border-emerald-200/50'
          },
          {
            title: 'Last Status Error',
            value: agentStatus.lastError || 'No errors reported',
            desc: 'Latest failed sync execution result',
            icon: <XCircle className="h-5 w-5 text-red-600" />,
            bgColor: agentStatus.lastError ? 'bg-red-50/50 border border-red-200/50 text-red-900' : 'bg-slate-50/50 border border-slate-200/50'
          }
        ].map((stat, i) => (
          <div key={i} className={cn("rounded-2xl p-4.5 transition-all shadow-sm flex items-start gap-3.5", stat.bgColor)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs">
              {stat.icon}
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
              <p className="font-extrabold text-slate-900 text-sm mt-1 truncate leading-tight select-text" title={stat.value}>{stat.value}</p>
              <span className="block text-[10px] text-slate-400 font-medium mt-1 leading-snug">{stat.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column - Member Search & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Member Test Action Simulator"
            description="Search for any registered member to directly override values or inject status change triggers."
            icon={<Search className="h-5 w-5" />}
          >
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Name, Member ID (UUID), Biometric ID (PIN), or Phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="btn btn-primary px-5 text-xs font-bold shrink-0 shadow-md shadow-amber-500/10"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {/* Search Results List */}
            {searchResults.length > 0 ? (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                  Search Results ({searchResults.length})
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((member) => (
                    <div 
                      key={member.id} 
                      className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs hover:border-amber-400/60 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-extrabold text-slate-900 text-sm select-text truncate">{member.full_name}</h4>
                          <span className={cn(
                            "font-bold uppercase text-[9px] px-1.5 py-0.5 rounded tracking-wide border",
                            member.status === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40' 
                              : 'bg-red-50 text-red-700 border-red-200/40'
                          )}>
                            {member.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5 select-all">UUID: {member.id}</p>
                        
                        <div className="mt-3.5 space-y-2 border-t border-slate-100/80 pt-3 text-xs">
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Biometric ID (PIN):</span>
                            <span className="font-bold text-slate-950 font-mono select-all">
                              {member.biometric_user_id || 'Not Mapped'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Biometric Status:</span>
                            <span className={cn(
                              "font-bold text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded-md",
                              member.biometric_status === 'ENABLED' 
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                                : 'bg-red-500/10 text-red-600 border border-red-500/20'
                            )}>
                              {member.biometric_status === 'ENABLED' ? (
                                <><Check className="h-3 w-3" /> Enabled</>
                              ) : (
                                <><Ban className="h-3 w-3" /> Disabled</>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Membership Expiry:</span>
                            <span className="font-bold text-slate-800 select-all">
                              {member.package_end_date ? new Date(member.package_end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Lifetime/None'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Simulator Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100">
                        <button
                          onClick={() => handleAction('disableTest', member.id)}
                          disabled={processingId !== null || !member.biometric_user_id}
                          className="btn btn-secondary text-[10px] py-2 px-1 text-center justify-center font-bold border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50"
                          title="Set member database state to DISABLED and queue ADMS delete command"
                        >
                          Disable Biometric (Test)
                        </button>
                        <button
                          onClick={() => handleAction('enableTest', member.id)}
                          disabled={processingId !== null || !member.biometric_user_id}
                          className="btn btn-secondary text-[10px] py-2 px-1 text-center justify-center font-bold border border-emerald-200 hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                          title="Set member database state to ENABLED and queue ADMS user info & template upload commands"
                        >
                          Enable Biometric (Test)
                        </button>
                        <button
                          onClick={() => handleAction('queueDisable', member.id)}
                          disabled={processingId !== null || !member.biometric_user_id}
                          className="btn btn-secondary text-[10px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-slate-600 disabled:opacity-50"
                          title="Queue ADMS delete command without modifying the member's current database state"
                        >
                          Queue Disable Action
                        </button>
                        <button
                          onClick={() => handleAction('queueEnable', member.id)}
                          disabled={processingId !== null || !member.biometric_user_id}
                          className="btn btn-secondary text-[10px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-slate-600 disabled:opacity-50"
                          title="Queue ADMS update commands without modifying the member's current database state"
                        >
                          Queue Enable Action
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 bg-slate-50/20">
                <Search className="h-8 w-8 mx-auto text-slate-300 mb-2.5" />
                <p className="text-xs font-semibold text-slate-600">Search for a member above</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Results will display active configurations, enrollment parameters, and quick simulation buttons.</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column - Pending Queue Display */}
        <div className="lg:col-span-1">
          <SectionCard
            title="Biometric Actions Queue"
            description="Live queue of enqueued sync instructions cached in Supabase database."
            icon={<Database className="h-5 w-5" />}
            action={
              actionsQueue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Clear Queue
                </button>
              )
            }
          >
            {actionsQueue.length > 0 ? (
              <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                {actionsQueue.map((item) => {
                  const isEnable = item.action === 'enable';
                  const isTestMode = item.notes === 'TEST MODE';
                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "rounded-xl p-4.5 border text-xs shadow-xs transition-all relative overflow-hidden",
                        item.status === 'pending' ? 'bg-amber-50/30 border-amber-200/50' : 
                        item.status === 'sent' ? 'bg-blue-50/30 border-blue-200/50' :
                        item.status === 'completed' ? 'bg-emerald-50/30 border-emerald-200/50' :
                        'bg-red-50/30 border-red-200/50'
                      )}
                    >
                      {/* Test Mode Flag */}
                      {isTestMode && (
                        <div className="absolute right-0 top-0 bg-amber-400 text-zinc-950 font-black uppercase text-[8px] tracking-wider px-2 py-0.5 rounded-bl shadow-xs">
                          TEST MODE
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs select-text">{item.member_name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono select-all">PIN: {item.biometric_id}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100/80 pt-3.5 mt-3 text-[10px] font-medium text-slate-500">
                        <div>
                          <span>Instruction:</span>
                          <span className={cn(
                            "block font-bold text-xs uppercase mt-0.5",
                            isEnable ? "text-emerald-600" : "text-red-600"
                          )}>
                            {item.action === 'enable' ? 'Enable' : 'Disable'}
                          </span>
                        </div>
                        <div>
                          <span>Status:</span>
                          <span className={cn(
                            "block font-bold text-xs uppercase mt-0.5",
                            item.status === 'pending' ? 'text-amber-500' :
                            item.status === 'sent' ? 'text-blue-500' :
                            item.status === 'completed' ? 'text-emerald-500' :
                            'text-red-500'
                          )}>
                            {item.status}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100/50 pt-2.5 mt-2.5 text-[9px] text-slate-400 font-medium">
                        <div className="flex justify-between">
                          <span>Queued:</span>
                          <span className="font-mono">{formatTimeSafe(item.created_at)}</span>
                        </div>
                        {item.status === 'completed' && (
                          <div className="flex justify-between mt-1 text-emerald-600/80">
                            <span>Completed:</span>
                            <span className="font-mono">{formatTimeSafe(item.updated_at)}</span>
                          </div>
                        )}
                        {item.notes && !isTestMode && (
                          <div className="mt-1.5 p-1 rounded bg-slate-50 text-[9px] text-slate-500 select-text">
                            Notes: {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 bg-slate-50/20">
                <Database className="h-8 w-8 mx-auto text-slate-300 mb-2.5" />
                <p className="text-xs font-semibold text-slate-600">Pending Queue is Empty</p>
                <p className="text-[10px] text-slate-400 mt-1">No pending enqueued commands detected. Simulators will register entries here.</p>
              </div>
            )}
          </SectionCard>
        </div>

      </div>

    </div>
  );
}
