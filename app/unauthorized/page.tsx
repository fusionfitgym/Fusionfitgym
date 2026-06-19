'use client';

import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-white px-4 relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-red-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-red-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center">
        <div className="bg-[#121620] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="h-8 w-8" />
            </div>
          </div>

          <h1 className="text-xl font-extrabold text-white tracking-tight">Access Denied</h1>
          <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
            Your user account role does not have the necessary permissions to access this page. If you believe this is an error, please contact your system administrator.
          </p>

          <div className="mt-8">
            <Link
              href="/"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-bold text-sm shadow-[0_4px_20px_rgba(244,196,48,0.18)] hover:bg-amber-400 active:transform active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" /> Go back to Dashboard
            </Link>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          &copy; {new Date().getFullYear()} FusionFit Gym ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
