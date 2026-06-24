'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PwaRegister() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          setRegistration(reg);

          // Check if there is already an updated worker waiting
          if (reg.waiting) {
            setShowUpdate(true);
          }

          // Listen for new worker installs
          reg.onupdatefound = () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.onstatechange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setShowUpdate(true);
                }
              };
            }
          };
        } catch (error) {
          console.error('PWA Service Worker registration failed:', error);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  // Listen to controllerchange so that if another tab triggers skipWaiting, we also reload
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    }
  }, []);

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdate(false);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-3 rounded-xl border border-zinc-800 bg-[#0b0d12]/95 p-4 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
          <RefreshCw className="h-4 w-4 animate-spin-slow" />
        </div>
        <div className="flex-1 text-xs">
          <p className="font-bold text-white">System Update Available</p>
          <p className="text-zinc-400 mt-0.5 leading-relaxed">
            A new version of FusionFit is ready. Refresh now to load the latest features.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setShowUpdate(false)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-zinc-400 hover:text-white transition"
        >
          Later
        </button>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-300 text-zinc-950 hover:bg-amber-400 transition shadow-[0_4px_12px_rgba(244,196,48,0.15)]"
        >
          Update Now
        </button>
      </div>
    </div>
  );
}
