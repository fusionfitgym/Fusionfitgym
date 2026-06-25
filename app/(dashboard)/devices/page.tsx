'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Clock, 
  HardDrive, 
  Users, 
  Signal, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Eye, 
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { getDevices } from '@/lib/actions/devices';
import { BiometricDevice } from '@/types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export default function DevicesPage() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<BiometricDevice | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Tick state to update elapsed times every 15 seconds
  const [tick, setTick] = useState(0);

  const fetchDevicesData = () => {
    getDevices()
      .then((data) => {
        setDevices(data);
      })
      .catch((err) => console.error('Failed to load devices:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevicesData();
  }, []);

  // Set up Supabase Realtime Subscription
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('devices_realtime_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setDevices((prev) => {
              if (prev.some((d) => d.device_id === payload.new.device_id)) {
                return prev.map((d) => d.device_id === payload.new.device_id ? payload.new : d);
              }
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((d) => (d.device_id === payload.new.device_id ? payload.new : d))
            );
            // If the selected device was updated, update modal state too
            setSelectedDevice((current) => {
              if (current && current.device_id === payload.new.device_id) {
                return payload.new;
              }
              return current;
            });
          } else if (payload.eventType === 'DELETE') {
            setDevices((prev) => prev.filter((d) => d.device_id !== payload.old.device_id));
            setSelectedDevice((current) => {
              if (current && current.device_id === payload.old.device_id) {
                return null;
              }
              return current;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update relative times and client-side statuses every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Health Calculation Logic
  const getDeviceStatus = (lastSeen: string | null | undefined): 'Online' | 'Warning' | 'Offline' => {
    if (!lastSeen) return 'Offline';
    const lastSeenTime = new Date(lastSeen).getTime();
    const diffMinutes = (Date.now() - lastSeenTime) / 60000;
    if (diffMinutes < 2) return 'Online';
    if (diffMinutes <= 5) return 'Warning';
    return 'Offline';
  };

  // Formatting utilities
  const formatRelativeTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 0) return 'Just now';
    if (diffSec < 60) return `${diffSec} sec ago`;
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const formatAbsoluteTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  // Compute stats dynamically based on calculated statuses
  const calculatedDevices = devices.map((d) => ({
    ...d,
    computedStatus: getDeviceStatus(d.last_seen),
  }));

  const totalCount = calculatedDevices.length;
  const onlineCount = calculatedDevices.filter((d) => d.computedStatus === 'Online').length;
  const warningCount = calculatedDevices.filter((d) => d.computedStatus === 'Warning').length;
  const offlineCount = calculatedDevices.filter((d) => d.computedStatus === 'Offline').length;

  // Find the most recent sync event among all devices
  const latestSyncTime = devices.reduce<string | null>((latest, device) => {
    const times = [device.last_seen, device.lastheartbeat, device.lastattendancereceived]
      .filter(Boolean)
      .map((t) => new Date(t!).getTime());
    if (times.length === 0) return latest;
    const maxTime = Math.max(...times);
    if (!latest || maxTime > new Date(latest).getTime()) {
      return new Date(maxTime).toISOString();
    }
    return latest;
  }, null);

  // Pagination Logic
  const totalPages = Math.ceil(calculatedDevices.length / itemsPerPage) || 1;
  const currentDevicesSlice = calculatedDevices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="page page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <PageHeader
          title="Biometric Device Status"
          subtitle="Live status monitoring, heartbeat reporting, and attendance stream logs for active hardware terminals."
        />
        
        {/* Last Sync Indicator */}
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm self-start md:mt-2">
          <Signal className={cn(
            "h-4.5 w-4.5", 
            onlineCount > 0 ? "text-emerald-500 animate-pulse" : "text-slate-400"
          )} />
          <div className="text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Device Sync</p>
            <p className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              {latestSyncTime ? formatAbsoluteTime(latestSyncTime) : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Panel */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6 mt-6">
        <div className="card flex items-center justify-between p-5 border-slate-200 hover:border-slate-350 transition-colors">
          <div>
            <p className="metric-label">Total Devices</p>
            <p className="mt-1.5 text-3xl font-extrabold text-slate-955">{totalCount}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-inner">
            <HardDrive className="h-5.5 w-5.5" />
          </span>
        </div>

        <div className="card flex items-center justify-between p-5 border-emerald-100 bg-emerald-50/10 hover:border-emerald-200 transition-colors">
          <div>
            <p className="metric-label text-emerald-800 font-medium">Online</p>
            <p className="mt-1.5 text-3xl font-extrabold text-emerald-955">{onlineCount}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-5.5 w-5.5" />
          </span>
        </div>

        <div className="card flex items-center justify-between p-5 border-amber-100 bg-amber-50/10 hover:border-amber-200 transition-colors">
          <div>
            <p className="metric-label text-amber-800 font-medium">Warning</p>
            <p className="mt-1.5 text-3xl font-extrabold text-amber-955">{warningCount}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Clock className="h-5.5 w-5.5" />
          </span>
        </div>

        <div className="card flex items-center justify-between p-5 border-rose-100 bg-rose-50/10 hover:border-rose-200 transition-colors">
          <div>
            <p className="metric-label text-rose-800 font-medium">Offline</p>
            <p className="mt-1.5 text-3xl font-extrabold text-rose-955">{offlineCount}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5.5 w-5.5" />
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-8">
        {loading ? (
          <div className="card p-16 text-center text-slate-400 border-slate-200">
            <div className="spinner mx-auto mb-4" />
            <p className="text-sm font-medium">Loading hardware terminals...</p>
          </div>
        ) : devices.length === 0 ? (
          /* Empty State */
          <div className="card p-16 text-center border-slate-200 bg-slate-50/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 border border-amber-100 shadow-sm mb-4">
              <Cpu className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No biometric devices detected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              No biometric devices detected. Install Fusion Fit Sync Agent and connect biometric hardware.
            </p>
          </div>
        ) : (
          /* Devices Grid */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {currentDevicesSlice.map((device) => {
                const isOnline = device.computedStatus === 'Online';
                const isWarning = device.computedStatus === 'Warning';
                
                return (
                  <div 
                    key={device.device_id} 
                    onClick={() => setSelectedDevice(device)}
                    className="card p-6 flex flex-col justify-between border-slate-200 hover:border-slate-350 hover:shadow-md transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5 group relative overflow-hidden bg-white"
                  >
                    {/* Status accent line */}
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1 transition-colors",
                      isOnline ? "bg-emerald-500" : isWarning ? "bg-amber-500" : "bg-rose-500"
                    )} />

                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                            isOnline 
                              ? "bg-emerald-50 text-emerald-600" 
                              : isWarning 
                                ? "bg-amber-50 text-amber-600" 
                                : "bg-rose-50/50 text-rose-500"
                          )}>
                            <Cpu className="h-5 w-5" />
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 group-hover:text-slate-950 transition-colors leading-snug">{device.device_name}</h3>
                            <span className="font-mono text-[10px] font-semibold text-slate-400 select-all tracking-wider">{device.device_id}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={cn(
                          "badge flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm transition-all",
                          isOnline 
                            ? "bg-emerald-50/50 text-emerald-700 border-emerald-200" 
                            : isWarning 
                              ? "bg-amber-50/50 text-amber-700 border-amber-200" 
                              : "bg-rose-50/40 text-rose-700 border-rose-200"
                        )}>
                          {isOnline ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </>
                          ) : isWarning ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Warning
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Offline
                            </>
                          )}
                        </span>
                      </div>

                      {/* Information Grid */}
                      <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">IP Address:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {device.device_ip ? `${device.device_ip}:${device.device_port || 80}` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Latency:</span>
                          <span className="font-medium text-slate-800">
                            {device.latency !== null && device.latency !== undefined ? `${device.latency}ms` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">User Count:</span>
                          <span className="font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {device.users_count || 0}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Last Seen:</span>
                          <span className="font-medium text-slate-800">
                            {formatRelativeTime(device.last_seen)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-slate-50 pt-3 text-[10px] text-slate-400 font-medium">
                      <span>Click to view diagnostics</span>
                      <Info className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-150 pt-4 mt-6">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage - itemsPerPage + 1, calculatedDevices.length)}</span> to{' '}
                  <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, calculatedDevices.length)}</span> of{' '}
                  <span className="font-bold text-slate-700">{calculatedDevices.length}</span> devices
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Previous Page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(idx + 1)}
                      className={cn(
                        "btn text-xs px-3.5 py-2",
                        currentPage === idx + 1 
                          ? "btn-primary font-bold" 
                          : "btn-secondary"
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Next Page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Device Details Modal */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-[#0f172a80] backdrop-blur-sm flex items-center justify-center z-50 fade-in select-none">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedDevice.device_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Biometric Device Diagnostic Console</p>
              </div>
              <span className={cn(
                "badge flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm",
                getDeviceStatus(selectedDevice.last_seen) === 'Online'
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : getDeviceStatus(selectedDevice.last_seen) === 'Warning'
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
              )}>
                {getDeviceStatus(selectedDevice.last_seen)}
              </span>
            </div>

            {/* Diagnostic Information Fields */}
            <div className="space-y-3 bg-slate-50/70 border border-slate-100 p-4 rounded-xl font-medium text-xs text-slate-800">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Device IP Address:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDevice.device_ip || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Listener Port:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDevice.device_port || 80}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Serial Number:</span>
                <span className="font-mono font-bold text-slate-900 select-all">{selectedDevice.device_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Terminal Latency:</span>
                <span className="font-bold text-slate-900">{selectedDevice.latency !== null && selectedDevice.latency !== undefined ? `${selectedDevice.latency}ms` : '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Users Registered:</span>
                <span className="font-bold text-slate-900">{selectedDevice.users_count || 0}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Last Seen:</span>
                <span className="font-bold text-slate-900" title={formatAbsoluteTime(selectedDevice.last_seen)}>
                  {selectedDevice.last_seen ? `${formatAbsoluteTime(selectedDevice.last_seen)} (${formatRelativeTime(selectedDevice.last_seen)})` : 'Never'}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Last Heartbeat:</span>
                <span className="font-bold text-slate-900" title={formatAbsoluteTime(selectedDevice.lastheartbeat)}>
                  {selectedDevice.lastheartbeat ? `${formatAbsoluteTime(selectedDevice.lastheartbeat)} (${formatRelativeTime(selectedDevice.lastheartbeat)})` : 'Never'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Attendance Received:</span>
                <span className="font-bold text-slate-900" title={formatAbsoluteTime(selectedDevice.lastattendancereceived)}>
                  {selectedDevice.lastattendancereceived ? `${formatAbsoluteTime(selectedDevice.lastattendancereceived)} (${formatRelativeTime(selectedDevice.lastattendancereceived)})` : 'Never'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
              {/* View Attendance Log Redirect Button */}
              <Link
                href={`/attendance?device_id=${selectedDevice.device_id}`}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Eye className="h-4 w-4" /> View Attendance
              </Link>
              <button
                type="button"
                onClick={() => setSelectedDevice(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
