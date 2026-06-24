'use client';

import { Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function OfflineNotification() {
  const [isOnline, setIsOnline] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setNotificationType('online');
      setShowNotification(true);
      // Auto-hide online notification after 3 seconds
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNotificationType('offline');
      setShowNotification(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // If initial check is offline, show it
    if (!navigator.onLine) {
      setIsOnline(false);
      setNotificationType('offline');
      setShowNotification(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showNotification) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 z-[10000] flex w-full max-w-sm -translate-x-1/2 transform items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl transition-all duration-300 ${
        notificationType === 'offline'
          ? 'border-red-500/30 bg-red-950/95 text-red-100 animate-in slide-in-from-top-10'
          : 'border-green-500/30 bg-green-950/95 text-green-100 animate-in slide-in-from-top-10'
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
        {notificationType === 'offline' ? (
          <WifiOff className="h-4.5 w-4.5 text-red-400" />
        ) : (
          <Wifi className="h-4.5 w-4.5 text-green-400" />
        )}
      </div>

      <div className="flex-1 text-xs">
        {notificationType === 'offline' ? (
          <>
            <p className="font-bold">Offline Mode Active</p>
            <p className="text-red-300/80 mt-0.5">Using cached data. Changes will sync later.</p>
          </>
        ) : (
          <>
            <p className="font-bold">Connection Restored</p>
            <p className="text-green-300/80 mt-0.5">You are back online. Synchronizing data...</p>
          </>
        )}
      </div>

      {notificationType === 'offline' && (
        <button
          onClick={() => setShowNotification(false)}
          className="text-xs font-semibold text-red-300 hover:text-white transition-colors"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
