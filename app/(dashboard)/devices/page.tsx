'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Cpu, 
  HardDrive, 
  Signal, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Eye, 
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
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [tick, setTick] = useState(0);

  const fetchDevicesData = () => {
    getDevices()
      .then((data) => {
        console.log('Incoming devices:', data);
        setDevices(data);
      })
      .catch((err) => console.error('Failed to load devices:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevicesData();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('devices_realtime_dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biometric_devices' },
        (payload: any) => {
          console.log('Realtime payload:', payload);
          if (payload.eventType === 'INSERT') {
            setDevices((prev) => {
              if (prev.some((d) => d.serial_number === payload.new.serial_number)) {
                return prev.map((d) => d.serial_number === payload.new.serial_number ? payload.new : d);
              }
              return [...prev, payload.new];
            });
          } else if (payload.eventType === 'UPDATE') {
            setDevices((prev) =>
              prev.map((d) => (d.serial_number === payload.new.serial_number ? payload.new : d))
            );
            setSelectedDevice((current) => {
              if (current && current.serial_number === payload.new.serial_number) {
                return payload.new;
              }
              return current;
            });
          } else if (payload.eventType === 'DELETE') {
            setDevices((prev) => prev.filter((d) => d.serial_number !== payload.old.serial_number));
            setSelectedDevice((current) => {
              if (current && current.serial_number === payload.old.serial_number) {
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

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

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

  const totalCount = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'Online').length;
  const offlineCount = devices.filter((d) => d.status !== 'Online').length;

  const latestSyncTime = devices.reduce<string | null>((latest, device) => {
    if (!device.last_sync) return latest;
    const time = new Date(device.last_sync).getTime();
    if (!latest || time > new Date(latest).getTime()) {
      return device.last_sync;
    }
    return latest;
  }, null);

  const totalPages = Math.ceil(devices.length / itemsPerPage) || 1;
  const currentDevicesSlice = devices.slice(
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:gap-6 mt-6">
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

      <div className="mt-8">
        {loading ? (
          <div className="card p-16 text-center text-slate-400 border-slate-200">
            <div className="spinner mx-auto mb-4" />
            <p className="text-sm font-medium">Loading hardware terminals...</p>
          </div>
        ) : devices.length === 0 ? (
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
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {currentDevicesSlice.map((device) => {
                const isOnline = device.status === 'Online';
                
                return (
                  <div 
                    key={device.serial_number} 
                    onClick={() => setSelectedDevice(device)}
                    className="card p-6 flex flex-col justify-between border-slate-200 hover:border-slate-350 hover:shadow-md transition-all duration-300 cursor-pointer transform hover:-translate-y-0.5 group relative overflow-hidden bg-white"
                  >
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1 transition-colors",
                      isOnline ? "bg-emerald-500" : "bg-rose-500"
                    )} />

                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                            isOnline 
                              ? "bg-emerald-50 text-emerald-600" 
                              : "bg-rose-50/50 text-rose-500"
                          )}>
                            <Cpu className="h-5 w-5" />
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 group-hover:text-slate-950 transition-colors leading-snug">{device.name}</h3>
                            <span className="font-mono text-[10px] font-semibold text-slate-400 select-all tracking-wider">{device.serial_number}</span>
                          </div>
                        </div>

                        <span className={cn(
                          "badge flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm transition-all",
                          isOnline 
                            ? "bg-emerald-50/50 text-emerald-700 border-emerald-200" 
                            : "bg-rose-50/40 text-rose-700 border-rose-200"
                        )}>
                          {isOnline ? (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Online
                            </>
                          ) : (
                            <>
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Offline
                            </>
                          )}
                        </span>
                      </div>

                      <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">IP Address:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {device.ip_address || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Status:</span>
                          <span className={cn(
                            "font-semibold",
                            isOnline ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {device.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Last Sync:</span>
                          <span className="font-medium text-slate-800">
                            {formatRelativeTime(device.last_sync)}
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

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-150 pt-4 mt-6">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage - itemsPerPage + 1, devices.length)}</span> to{' '}
                  <span className="font-bold text-slate-700">{Math.min(currentPage * itemsPerPage, devices.length)}</span> of{' '}
                  <span className="font-bold text-slate-700">{devices.length}</span> devices
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn btn-secondary p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePageChange(idx + 1)}
                      className={cn(
                        "btn text-xs px-3.5 py-2",
                        currentPage === idx + 1 ? "btn-primary font-bold" : "btn-secondary"
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn btn-secondary p-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDevice && (
        <div className="fixed inset-0 bg-[#0f172a80] backdrop-blur-sm flex items-center justify-center z-50 fade-in select-none">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedDevice.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Biometric Device Diagnostic Console</p>
              </div>
              <span className={cn(
                "badge flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm",
                selectedDevice.status === 'Online'
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              )}>
                {selectedDevice.status}
              </span>
            </div>

            <div className="space-y-3 bg-slate-50/70 border border-slate-100 p-4 rounded-xl font-medium text-xs text-slate-800">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Device IP Address:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDevice.ip_address || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Serial Number:</span>
                <span className="font-mono font-bold text-slate-900 select-all">{selectedDevice.serial_number}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400">Status:</span>
                <span className={cn(
                  "font-bold",
                  selectedDevice.status === 'Online' ? "text-emerald-600" : "text-rose-600"
                )}>{selectedDevice.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Sync:</span>
                <span className="font-bold text-slate-900" title={formatAbsoluteTime(selectedDevice.last_sync)}>
                  {selectedDevice.last_sync ? `${formatAbsoluteTime(selectedDevice.last_sync)} (${formatRelativeTime(selectedDevice.last_sync)})` : 'Never'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-3">
              <Link
                href={`/attendance?device_id=${selectedDevice.serial_number}`}
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
