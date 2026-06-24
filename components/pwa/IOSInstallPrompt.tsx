'use client';

import { X, Share, PlusSquare, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

interface IOSInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IOSInstallPrompt({ isOpen, onClose }: IOSInstallPromptProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setMounted(false), 200);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen && !mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-end justify-center p-4 transition-all duration-300 sm:items-center sm:p-6 ${
        isOpen ? 'bg-black/60 opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Background click overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-md transform rounded-2xl border border-zinc-800 bg-[#0b0d12] p-6 text-white shadow-2xl transition-all duration-300 ${
          isOpen ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
          aria-label="Close guide"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300 text-zinc-950">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Install FusionFit on iOS</h3>
            <p className="text-xs text-zinc-400">Add to your home screen for full app experience</p>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="flex items-start gap-3 rounded-xl bg-zinc-900/50 p-3 border border-white/[0.03]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-300">
              1
            </div>
            <div className="flex-1 text-sm text-zinc-300">
              Open this web app in <span className="font-semibold text-white">Safari browser</span>.
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 rounded-xl bg-zinc-900/50 p-3 border border-white/[0.03]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-300">
              2
            </div>
            <div className="flex-1 text-sm text-zinc-300">
              Tap the <span className="inline-flex items-center gap-1 font-semibold text-white">
                Share <Share className="h-4 w-4 text-blue-400 inline" strokeWidth={2.2} />
              </span> button at the bottom of the screen (or top-right on iPad).
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 rounded-xl bg-zinc-900/50 p-3 border border-white/[0.03]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-300">
              3
            </div>
            <div className="flex-1 text-sm text-zinc-300">
              Scroll down the sharing menu and tap <span className="inline-flex items-center gap-1 font-semibold text-white">
                Add to Home Screen <PlusSquare className="h-4 w-4 text-zinc-300 inline" />
              </span>.
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start gap-3 rounded-xl bg-zinc-900/50 p-3 border border-white/[0.03]">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-amber-300">
              4
            </div>
            <div className="flex-1 text-sm text-zinc-300">
              Tap <span className="font-bold text-amber-300">Add</span> in the top-right corner to complete the installation.
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-5 text-center text-[11px] text-zinc-500 font-medium">
          Installing lets you run FusionFit in full-screen with offline support.
        </p>
      </div>
    </div>
  );
}
