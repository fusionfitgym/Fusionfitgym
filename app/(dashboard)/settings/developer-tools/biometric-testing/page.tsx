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
  ArrowLeft,
  Activity,
  Check,
  Ban,
  Play,
  HelpCircle,
  Eye,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader, SectionCard } from '@/components/ui/Primitives';
import { toast } from 'sonner';
import { 
  searchMembersForTesting,
  queueBlockAction,
  queueUnblockAction,
  queueDeleteAction,
  queueVerifyUserAction,
  queueReadUserAction,
  clearPendingActions,
  getPendingQueue,
  getSyncAgentStatus,
  SearchMemberResult,
  BiometricQueueItem,
  SyncAgentStatus
} from '@/lib/actions/biometric-testing';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

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
    if (showToast) setRefreshing(true);
    try {
      const [queueData, statusData] = await Promise.all([
        getPendingQueue(),
        getSyncAgentStatus()
      ]);
      setActionsQueue(queueData);
      setAgentStatus(statusData);
      if (showToast) {
        toast.success('Diagnostics refreshed successfully');
      }
    } catch (err: any) {
      console.error('Error fetching testing metrics:', err);
      toast.error('Failed to load metrics: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Realtime updates subscription
  useEffect(() => {
    fetchQueueAndStatus();

    if (profile?.role !== 'Super Admin') return;

    const supabase = createClient();
    const channel = supabase
      .channel('biometric_testing_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biometric_actions' },
        (payload) => {
          console.log('Realtime change in biometric testing panel:', payload);
          // Re-fetch queue and agent status
          fetchQueueAndStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        toast.info('No members or staff found matching your search');
      } else {
        toast.success(`Found ${results.length} record(s)`);
      }
    } catch (err: any) {
      toast.error('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  // Handle Simulator Actions
  const handleAction = async (
    actionType: 'block' | 'unblock' | 'delete' | 'verify' | 'read', 
    entityId: string, 
    entityType: 'member' | 'staff'
  ) => {
    setProcessingId(`${actionType}-${entityId}`);
    try {
      let res;
      switch (actionType) {
        case 'block':
          res = await queueBlockAction(entityId, entityType);
          break;
        case 'unblock':
          res = await queueUnblockAction(entityId, entityType);
          break;
        case 'delete':
          res = await queueDeleteAction(entityId, entityType);
          break;
        case 'verify':
          res = await queueVerifyUserAction(entityId, entityType);
          break;
        case 'read':
          res = await queueReadUserAction(entityId, entityType);
          break;
      }

      if (res?.success) {
        toast.success(`Biometric action queued successfully!`);
        // Refresh local search details
        if (searchQuery.trim()) {
          const results = await searchMembersForTesting(searchQuery);
          setSearchResults(results);
        }
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
    if (!confirm('Are you sure you want to clear all active actions in the queue? This will cancel unprocessed biometric updates.')) {
      return;
    }
    try {
      const res = await clearPendingActions();
      if (res.success) {
        toast.success('Biometric action queue cleared');
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
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center select-none">
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
            title: 'Active Queue Size',
            value: `${agentStatus.queueSize} action(s)`,
            desc: 'Actions currently waiting or processing',
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
            icon: <XCircle className="h-5 w-5 text-rose-600" />,
            bgColor: agentStatus.lastError ? 'bg-rose-50/50 border border-rose-200/50 text-rose-900' : 'bg-slate-50/50 border border-slate-200/50'
          }
        ].map((stat, i) => (
          <div key={i} className={cn("rounded-2xl p-4.5 transition-all shadow-sm flex items-start gap-3.5", stat.bgColor)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-xs">
              {stat.icon}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.title}</span>
              <p className="font-extrabold text-slate-900 text-sm mt-1 truncate leading-tight select-text" title={stat.value}>{stat.value}</p>
              <span className="block text-[10px] text-slate-400 font-medium mt-1 leading-snug">{stat.desc}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column - Member/Staff Search & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Biometric Simulator Trigger Console"
            description="Search for any member or staff to queue block/unblock/delete or standalone verification queries."
            icon={<Search className="h-5 w-5" />}
          >
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Name, Biometric ID, Card, Phone, or UUID..."
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
                  {searchResults.map((record) => (
                    <div 
                      key={record.id} 
                      className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs hover:border-amber-400/60 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-slate-900 text-sm select-text truncate" title={record.full_name}>
                              {record.full_name}
                            </h4>
                            <span className={cn(
                              "inline-block text-[8px] font-black uppercase tracking-widest px-1 py-0.2 rounded border mt-1",
                              record.entity_type === 'staff' 
                                ? 'bg-indigo-50 border-indigo-200/50 text-indigo-750' 
                                : 'bg-emerald-50 border-emerald-200/50 text-emerald-750'
                            )}>
                              {record.entity_type}
                            </span>
                          </div>
                          <span className={cn(
                            "font-bold uppercase text-[9px] px-1.5 py-0.5 rounded tracking-wide border shrink-0",
                            record.status === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40' 
                              : 'bg-red-50 text-red-700 border-red-200/40'
                          )}>
                            {record.status}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-400 font-mono mt-2.5 select-all">UUID: {record.id}</p>
                        
                        <div className="mt-3.5 space-y-2 border-t border-slate-100/80 pt-3 text-xs">
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Biometric PIN:</span>
                            <span className="font-bold text-slate-950 font-mono select-all">
                              {record.biometric_user_id || 'Not Mapped'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 font-medium">
                            <span>Biometric Status:</span>
                            <span className={cn(
                              "font-bold text-[10px] flex items-center gap-1.5 px-2 py-0.5 rounded-md",
                              record.biometric_status === 'ENABLED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                              record.biometric_status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse' :
                              record.biometric_status === 'BLOCKED' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                              record.biometric_status === 'DELETED' ? 'bg-slate-500/10 text-slate-600 border border-slate-500/20' :
                              'bg-red-500/10 text-red-650 border border-red-500/20'
                            )}>
                              {record.biometric_status === 'ENABLED' ? (
                                <><Check className="h-3 w-3" /> Enabled</>
                              ) : record.biometric_status === 'BLOCKED' ? (
                                <><Ban className="h-3 w-3" /> Blocked</>
                              ) : record.biometric_status === 'DELETED' ? (
                                <><Trash2 className="h-3 w-3" /> Deleted</>
                              ) : record.biometric_status === 'PENDING' ? (
                                <><Clock className="h-3 w-3" /> Verifying</>
                              ) : (
                                <><Ban className="h-3 w-3" /> Disabled</>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Simulator Trigger Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100">
                        <button
                          onClick={() => handleAction('block', record.id, record.entity_type)}
                          disabled={processingId !== null || !record.biometric_user_id}
                          className="btn btn-secondary text-[10.5px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-rose-600 hover:bg-rose-50/50 disabled:opacity-50 cursor-pointer"
                          title="Queue command to block user on terminal"
                        >
                          Queue Block (Enabled=0)
                        </button>
                        <button
                          onClick={() => handleAction('unblock', record.id, record.entity_type)}
                          disabled={processingId !== null || !record.biometric_user_id}
                          className="btn btn-secondary text-[10.5px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-emerald-600 hover:bg-emerald-50/50 disabled:opacity-50 cursor-pointer"
                          title="Queue command to unblock user on terminal"
                        >
                          Queue Unblock (Enabled=1)
                        </button>
                        <button
                          onClick={() => handleAction('delete', record.id, record.entity_type)}
                          disabled={processingId !== null || !record.biometric_user_id}
                          className="btn btn-secondary text-[10.5px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-rose-800 hover:bg-rose-100/10 disabled:opacity-50 cursor-pointer"
                          title="Queue command to physically delete user from terminal"
                        >
                          Queue Delete User
                        </button>
                        <button
                          onClick={() => handleAction('verify', record.id, record.entity_type)}
                          disabled={processingId !== null || !record.biometric_user_id}
                          className="btn btn-secondary text-[10.5px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-indigo-600 hover:bg-indigo-50/50 disabled:opacity-50 cursor-pointer"
                          title="Queue verification query command"
                        >
                          Queue Verify User
                        </button>
                        <button
                          onClick={() => handleAction('read', record.id, record.entity_type)}
                          disabled={processingId !== null || !record.biometric_user_id}
                          className="btn btn-secondary text-[10.5px] py-2 px-1 text-center justify-center font-bold border border-slate-200 text-purple-600 hover:bg-purple-50/50 disabled:opacity-50 cursor-pointer col-span-2"
                          title="Queue command to read userinfo templates"
                        >
                          Queue Read User (Fetch Data)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 bg-slate-50/20">
                <Search className="h-8 w-8 mx-auto text-slate-300 mb-2.5" />
                <p className="text-xs font-semibold text-slate-600">Search for a member or staff above</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">Results will display active configurations, enrollment parameters, and quick simulation buttons.</p>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right Column - Active Queue Display */}
        <div className="lg:col-span-1">
          <SectionCard
            title="Biometric Actions Queue"
            description="Live queue of enqueued sync instructions cached in Supabase database."
            icon={<Database className="h-5 w-5" />}
            action={
              actionsQueue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-transparent"
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
                  const isVerify = item.action === 'verify';
                  const isRead = item.action === 'read';
                  
                  return (
                    <div 
                      key={item.id} 
                      className={cn(
                        "rounded-xl p-4.5 border text-xs shadow-xs transition-all relative overflow-hidden",
                        item.status === 'pending' || item.status === 'sent' ? 'bg-amber-50/30 border-amber-200/50' : 
                        item.status === 'executing' ? 'bg-blue-50/30 border-blue-200/50' :
                        item.status === 'verifying' ? 'bg-purple-50/30 border-purple-200/50' :
                        item.status === 'completed' ? 'bg-emerald-50/30 border-emerald-200/50' :
                        'bg-red-50/30 border-red-200/50'
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900 text-xs select-text truncate max-w-[150px]">
                            {item.entity_name}
                          </span>
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-wider px-1 py-0.2 rounded border shrink-0",
                            item.entity_type === 'staff' 
                              ? 'bg-indigo-50 border-indigo-200/40 text-indigo-750' 
                              : 'bg-emerald-50 border-emerald-200/40 text-emerald-750'
                          )}>
                            {item.entity_type}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono select-all">PIN: {item.biometric_id}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100/80 pt-3.5 mt-3 text-[10px] font-medium text-slate-500">
                        <div>
                          <span>Instruction:</span>
                          <span className={cn(
                            "block font-bold text-xs uppercase mt-0.5",
                            isEnable ? "text-emerald-600" : 
                            isVerify ? "text-indigo-600" :
                            isRead ? "text-purple-600" : "text-red-650"
                          )}>
                            {item.action === 'enable' ? 'Unblock' : 
                             item.action === 'verify' ? 'Verify' :
                             item.action === 'read' ? 'Read (Fetch)' : 
                             `Disable (${item.disable_method || 'block'})`}
                          </span>
                        </div>
                        <div>
                          <span>Status:</span>
                          <span className={cn(
                            "block font-bold text-xs uppercase mt-0.5",
                            item.status === 'pending' || item.status === 'sent' ? 'text-amber-500' :
                            item.status === 'executing' ? 'text-blue-500 animate-pulse' :
                            item.status === 'verifying' ? 'text-purple-500 animate-pulse' :
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
                        {item.notes && (
                          <div className="mt-1.5 p-1 rounded bg-slate-50 text-[9px] text-slate-550 select-text">
                            Log: {item.notes}
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
