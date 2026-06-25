'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to server/telemetry
    console.error('Dashboard Error Boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 text-white relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/5 rounded-full filter blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center">
        {/* Error Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/25 shadow-[0_8px_24px_rgba(239,68,68,0.15)] mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-red-500" strokeWidth={2} />
        </div>

        {/* Header */}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">
          Failed to load dashboard data
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
          An unexpected error occurred while resolving real-time database queries. This might be a temporary network issue.
        </p>

        {/* Diagnostics details */}
        <div className="mt-6 mb-8 text-left bg-slate-900/60 border border-white/[0.06] rounded-xl p-4 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Diagnostic Log</span>
          <span className="text-xs text-red-400/90 font-mono block mt-1.5 break-all max-h-24 overflow-y-auto">
            {error.message || 'Unknown runtime render exception'}
          </span>
          {error.digest && (
            <span className="text-[10px] text-slate-500 font-mono block mt-1">
              Digest: {error.digest}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto min-h-[42px] px-5 flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-bold text-sm shadow-[0_4px_16px_rgba(244,196,48,0.15)] hover:bg-amber-400 active:transform active:scale-[0.98] transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto min-h-[42px] px-5 flex items-center justify-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 font-semibold text-sm hover:bg-white/[0.08] hover:text-white transition-all"
          >
            <Home className="h-4 w-4 shrink-0" />
            <span>Reload Page</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
