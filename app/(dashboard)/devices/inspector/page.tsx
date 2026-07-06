'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  RefreshCw, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Activity,
  Play,
  Ban,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2
} from 'lucide-react';
import { PageHeader, SectionCard } from '@/components/ui/Primitives';
import { 
  getInspectorCommands, 
  retryBiometricCommand, 
  cancelBiometricCommand, 
  InspectorCommandItem 
} from '@/lib/actions/biometric-commands';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function DeviceInspectorPage() {
  const [commands, setCommands] = useState<InspectorCommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  
  // Modal / Drawer state for logs
  const [selectedCmd, setSelectedCmd] = useState<InspectorCommandItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchCommands = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const data = await getInspectorCommands({
        status: statusFilter,
        action: actionFilter,
        search: searchQuery
      });
      setCommands(data);
      if (showToast) {
        toast.success('Inspector logs refreshed');
      }
    } catch (err: any) {
      console.error('Error fetching commands:', err);
      toast.error('Failed to load inspector commands');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, [statusFilter, actionFilter]);

  // Real-time listener
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('biometric_actions_inspector')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biometric_actions' },
        (payload: any) => {
          console.log('Realtime change in inspector:', payload);
          // If update, we merge the updated row (status, device_response, verification_result etc.)
          if (payload.eventType === 'UPDATE') {
            setCommands((prev) =>
              prev.map((cmd) => {
                if (cmd.id === payload.new.id) {
                  return {
                    ...cmd,
                    ...payload.new,
                    // Keep original entity_name and entity_type since realtime payload doesn't do joins
                    entity_name: cmd.entity_name,
                    entity_type: cmd.entity_type
                  };
                }
                return cmd;
              })
            );
            
            setSelectedCmd((current) => {
              if (current && current.id === payload.new.id) {
                return {
                  ...current,
                  ...payload.new
                };
              }
              return current;
            });
          } else {
            // For insert/delete, refresh list
            fetchCommands();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCommands(true);
  };

  const handleRetry = async (cmdId: string) => {
    const loadingToast = toast.loading('Retrying command...');
    try {
      const res = await retryBiometricCommand(cmdId);
      toast.dismiss(loadingToast);
      if (res.success) {
        toast.success('Command queued for retry');
        fetchCommands();
      } else {
        toast.error(res.error || 'Failed to retry command');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Error triggering retry');
    }
  };

  const handleCancel = async (cmdId: string) => {
    if (!confirm('Are you sure you want to cancel this command? It will be marked as failed.')) {
      return;
    }
    const loadingToast = toast.loading('Cancelling command...');
    try {
      const res = await cancelBiometricCommand(cmdId);
      toast.dismiss(loadingToast);
      if (res.success) {
        toast.success('Command cancelled');
        fetchCommands();
      } else {
        toast.error(res.error || 'Failed to cancel command');
      }
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error('Error cancelling command');
    }
  };

  // Status Badge Mapper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-250">
            <CheckCircle2 className="h-3 w-3" /> Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-250">
            <XCircle className="h-3 w-3" /> Failed
          </span>
        );
      case 'pending':
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-250 animate-pulse">
            <Clock className="h-3 w-3" /> Queued
          </span>
        );
      case 'executing':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-250 animate-pulse">
            <Activity className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} /> Executing
          </span>
        );
      case 'verifying':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-250 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" /> Verifying
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const formatAbsoluteTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Pagination calculation
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCommands = commands.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(commands.length / itemsPerPage) || 1;

  return (
    <div className="page page-wide page-enter select-none">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 select-none">
            <Link href="/devices" className="hover:text-slate-655 transition-colors">
              Device Management
            </Link>
            <span>/</span>
            <span className="text-amber-500">Inspector</span>
          </div>
          <h1 className="page-title text-slate-900 font-extrabold text-2xl tracking-tight">Device Command Inspector</h1>
          <p className="page-subtitle text-slate-500 text-sm mt-0.5">Audit log mirroring agent commands, physical hardware status flags, and verification results.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCommands(true)}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-xs font-bold animate-none"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh Inspector
          </button>
          <Link href="/devices/command-center" className="btn btn-secondary flex items-center gap-2 text-xs font-bold">
            Command Center Metrics
          </Link>
        </div>
      </header>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4.5 mb-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Biometric PIN, Command ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none transition-colors"
            />
          </div>

          {/* Action Filter */}
          <div className="relative w-full md:w-44">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white appearance-none font-semibold cursor-pointer"
            >
              <option value="all">All Actions</option>
              <option value="enable">Enable (Unblock)</option>
              <option value="disable">Disable (Block/Delete)</option>
              <option value="verify">Verify (Query User)</option>
              <option value="read">Read (Fetch User)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative w-full md:w-44">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-amber-400 focus:bg-white appearance-none font-semibold cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending/Sent</option>
              <option value="executing">Executing</option>
              <option value="verifying">Verifying</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary px-5 text-xs font-bold shrink-0 shadow-md shadow-amber-500/10"
          >
            Filter Logs
          </button>
        </form>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
            <span className="text-xs font-semibold">Loading command inspector logs...</span>
          </div>
        ) : currentCommands.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Member/Staff</th>
                  <th className="px-5 py-3.5">Biometric ID</th>
                  <th className="px-5 py-3.5">Action Command</th>
                  <th className="px-5 py-3.5">Device Response</th>
                  <th className="px-5 py-3.5">Verification</th>
                  <th className="px-5 py-3.5">Latency</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {currentCommands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Timestamp */}
                    <td className="px-5 py-4 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">
                      {formatAbsoluteTime(cmd.created_at)}
                    </td>
                    
                    {/* Member/Staff */}
                    <td className="px-5 py-4">
                      <div className="font-extrabold text-slate-900 select-text truncate max-w-[140px]" title={cmd.entity_name}>
                        {cmd.entity_name}
                      </div>
                      <span className={cn(
                        "inline-block text-[8px] font-black uppercase tracking-widest px-1 py-0.2 rounded border mt-1",
                        cmd.entity_type === 'staff' 
                          ? 'bg-indigo-50 border-indigo-200/50 text-indigo-750' 
                          : 'bg-emerald-50 border-emerald-200/50 text-emerald-750'
                      )}>
                        {cmd.entity_type}
                      </span>
                    </td>

                    {/* Biometric ID */}
                    <td className="px-5 py-4 font-mono font-bold text-slate-900 select-all">
                      {cmd.biometric_id}
                    </td>

                    {/* Action Command */}
                    <td className="px-5 py-4">
                      <span className="font-bold capitalize">{cmd.action}</span>
                      {cmd.action === 'disable' && (
                        <span className="text-[10px] text-slate-450 block font-normal">
                          Method: {cmd.disable_method || 'block'}
                        </span>
                      )}
                    </td>

                    {/* Device Response */}
                    <td className="px-5 py-4 font-mono text-[10.5px] text-slate-500 max-w-[150px] truncate select-text">
                      {cmd.device_response || '--'}
                    </td>

                    {/* Verification */}
                    <td className="px-5 py-4 text-slate-500 max-w-[150px] truncate select-text">
                      {cmd.verification_result || '--'}
                    </td>

                    {/* Latency */}
                    <td className="px-5 py-4 font-mono text-slate-500 whitespace-nowrap">
                      {cmd.execution_time_ms ? `${(cmd.execution_time_ms / 1000).toFixed(2)}s` : '--'}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(cmd.status)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCmd(cmd)}
                          className="btn btn-secondary p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                          title="View detailed JSON logs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        {cmd.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(cmd.id)}
                            className="btn btn-secondary p-1.5 border-emerald-100 hover:bg-emerald-50 text-emerald-600 cursor-pointer"
                            title="Retry Command"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(cmd.status === 'pending' || cmd.status === 'sent') && (
                          <button
                            onClick={() => handleCancel(cmd.id)}
                            className="btn btn-secondary p-1.5 border-red-100 hover:bg-red-50 text-red-600 cursor-pointer"
                            title="Cancel / Fail Command"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 text-center text-slate-400 bg-slate-50/20">
            <Terminal className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-655">No commands found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or search criteria.</p>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 select-none">
              Showing page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn btn-secondary flex items-center gap-1 text-xs py-1.5 px-3 font-semibold cursor-pointer disabled:opacity-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn btn-secondary flex items-center gap-1 text-xs py-1.5 px-3 font-semibold cursor-pointer disabled:opacity-50"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Drawer / Modal */}
      {selectedCmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs select-none">
          <div className="w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col justify-between p-6 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-4.5 mb-5">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                    <Terminal className="h-4.5 w-4.5 text-amber-500" /> Command Log Details
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5 select-all">UUID: {selectedCmd.id}</span>
                </div>
                <button
                  onClick={() => setSelectedCmd(null)}
                  className="btn btn-secondary py-1.5 px-2.5 text-xs font-bold border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4.5 font-medium text-slate-600">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity Name</span>
                    <span className="font-extrabold text-slate-900 text-xs mt-1 block">{selectedCmd.entity_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entity Type</span>
                    <span className="font-extrabold text-slate-900 text-xs mt-1 block capitalize">{selectedCmd.entity_type}</span>
                  </div>
                  <div className="mt-2.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Biometric PIN</span>
                    <span className="font-mono font-bold text-slate-900 text-xs mt-1 block select-all">{selectedCmd.biometric_id}</span>
                  </div>
                  <div className="mt-2.5">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status State</span>
                    <span className="mt-1 block">{getStatusBadge(selectedCmd.status)}</span>
                  </div>
                </div>

                {/* Command Payload String */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">Instruction string enqueued</span>
                  <pre className="font-mono text-[10px] leading-relaxed text-zinc-100 bg-slate-900 p-3.5 rounded-xl overflow-x-auto shadow-inner select-text">
                    ACTION={selectedCmd.action.toUpperCase()} PIN={selectedCmd.biometric_id} DISABLE_METHOD={selectedCmd.disable_method || 'block'}
                  </pre>
                </div>

                {/* Device Response log */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">Raw device response</span>
                  <pre className="font-mono text-[10px] leading-relaxed text-zinc-100 bg-slate-900 p-3.5 rounded-xl overflow-x-auto shadow-inner select-text">
                    {selectedCmd.device_response || '-- No response log recorded --'}
                  </pre>
                </div>

                {/* Verification result details */}
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">Verification details</span>
                  <div className={cn(
                    "p-3.5 rounded-xl border font-semibold",
                    selectedCmd.status === 'completed' ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' :
                    selectedCmd.status === 'failed' ? 'bg-rose-50/50 border-rose-100 text-rose-800' :
                    'bg-slate-50/50 border-slate-100 text-slate-650'
                  )}>
                    {selectedCmd.verification_result || 'Awaiting Sync Agent verification step.'}
                  </div>
                </div>

                {/* Error message log */}
                {selectedCmd.error_message && (
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 pl-0.5">Error log details</span>
                    <div className="p-3.5 rounded-xl border bg-rose-50 border-rose-100 text-rose-800 font-mono text-[10.5px] select-text">
                      {selectedCmd.error_message}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 mt-6 flex justify-end gap-3">
              {selectedCmd.status === 'failed' && (
                <button
                  onClick={() => {
                    handleRetry(selectedCmd.id);
                    setSelectedCmd(null);
                  }}
                  className="btn btn-primary flex items-center gap-2 text-xs font-bold px-5 py-2.5 shadow-md shadow-amber-500/10 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5" /> Retry Command
                </button>
              )}
              <button
                onClick={() => setSelectedCmd(null)}
                className="btn btn-secondary text-xs font-bold px-5 py-2.5 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  function handlePageChange(page: number) {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }
}
