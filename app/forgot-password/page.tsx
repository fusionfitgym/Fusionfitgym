'use client';

import { useState } from 'react';
import Link from 'next/navigation';
import { Dumbbell, Mail, ArrowLeft, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { resetPasswordForEmailAction } from '@/lib/actions/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Direct reset link pointing back to the code exchange callback
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
      await resetPasswordForEmailAction(email, redirectTo);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-white px-4 relative overflow-hidden select-none">
      {/* Background glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 shadow-[0_8px_24px_rgba(244,196,48,0.25)] mb-4">
            <Dumbbell className="h-7 w-7 text-zinc-950" strokeWidth={2.4} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">FusionFit</h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em] mt-1.5">Gym ERP Admin Portal</p>
        </div>

        <div className="bg-[#121620] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Reset Password</h2>
            <p className="text-xs text-zinc-400 mt-1">Enter your email and we'll send you a password reset link.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-400 font-semibold leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-6">
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-emerald-400 font-semibold leading-relaxed">
                <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-bold text-white text-sm">Check your email</p>
                  <p className="text-xs text-zinc-400 mt-1.5 font-normal">
                    We've sent a password recovery link to <strong className="text-emerald-300 font-bold">{email}</strong>.
                  </p>
                </div>
              </div>
              <a
                href="/login"
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] text-zinc-300 font-bold text-sm hover:bg-white/[0.06] transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full h-11 pl-11 pr-4 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white placeholder-zinc-600 text-sm font-medium transition-all hover:border-white/[0.18] focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-bold text-sm shadow-[0_4px_20px_rgba(244,196,48,0.18)] hover:bg-amber-400 active:transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                    <span>Sending recovery email...</span>
                  </>
                ) : (
                  <span>Send Recovery Link</span>
                )}
              </button>

              <div className="text-center pt-2">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Return to Login
                </a>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          &copy; {new Date().getFullYear()} FusionFit Gym ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
