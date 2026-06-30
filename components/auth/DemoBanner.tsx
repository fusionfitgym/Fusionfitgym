'use client';

import React, { useState } from 'react';
import { ShieldAlert, Info, X, ExternalLink } from 'lucide-react';

export default function DemoBanner() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5 text-xs text-amber-300">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-base">
            🎭
          </span>
          <div className="font-semibold leading-relaxed">
            <span className="font-bold text-amber-400">Demo Mode</span>
            <span className="mx-2 opacity-30">|</span>
            <span className="opacity-90">This is a demonstration environment. All data is sample data. Changes will not be saved.</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-amber-300 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-950 shadow-sm transition-all hover:bg-amber-400 active:scale-95 cursor-pointer"
        >
          <Info className="h-3 w-3" />
          <span>Learn More</span>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-dialog-in text-slate-800">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-950 leading-tight">About Demo Mode</h3>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">ERP Sandbox Environment</p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600 font-normal leading-relaxed">
              <p>
                Welcome to the <strong>FusionFit Gym ERP Demo Mode</strong>! You are logged in using a secure, client-side guest session.
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p><strong>Bypassed DB:</strong> No connections are made to the live Supabase production server.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p><strong>In-Memory CRUD:</strong> You can create, edit, or delete members, check-ins, and invoices in real-time, but they are stored only in the browser's temporary memory.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <p><strong>Auto Reset:</strong> Refreshing the browser page (F5) will immediately wipe any changes and restore the default 250 member datasets.</p>
                </div>
              </div>
              <p>
                System maintenance tools (e.g. Backups, SQL exports, Database operations) and User Account Management are locked for safety during the public demo.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-primary w-full cursor-pointer"
              >
                Got it, let's explore!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
