'use client';

import { Dumbbell, WifiOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function OfflinePage() {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        if (navigator.onLine) {
          window.location.href = '/';
        } else {
          setChecking(false);
        }
      }
    }, 800);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0d12] px-4 text-white">
      {/* Decorative gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-1/2 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-amber-400/5 blur-[80px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        {/* Brand Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300 shadow-[0_6px_20px_rgba(244,196,48,0.2)]">
            <Dumbbell className="h-5 w-5 text-zinc-950" strokeWidth={2.2} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold tracking-tight text-white">FusionFit</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Gym management</p>
          </div>
        </div>

        {/* Offline Icon Container */}
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-zinc-900 border border-white/[0.05]">
          <div className="absolute inset-0 rounded-3xl bg-amber-300/5 animate-pulse" />
          <WifiOff className="h-10 w-10 text-amber-300" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
          You are Offline
        </h1>
        
        {/* Subtitle */}
        <p className="mt-3 text-sm text-zinc-400 leading-relaxed px-4">
          FusionFit couldn't establish a connection to the server. Check your internet connection or try again.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full flex-col gap-3 px-6">
          <button
            onClick={handleRetry}
            disabled={checking}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 font-bold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking Connection...' : 'Retry Connection'}
          </button>
          
          <Link
            href="/"
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"
          >
            Go to Dashboard
          </Link>
        </div>

        {/* Status footer */}
        <div className="mt-12 text-[11px] text-zinc-600 font-medium">
          Powered by offline service caching.
        </div>
      </div>
    </div>
  );
}
