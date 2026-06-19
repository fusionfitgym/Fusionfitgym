'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Lock, Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { updatePasswordAction } from '@/lib/actions/auth';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updatePasswordAction(password);
      router.push('/login?message=Your password has been reset successfully. Please log in with your new password.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to reset password. Please request a new recovery link.');
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
            <h2 className="text-lg font-bold text-white">Choose New Password</h2>
            <p className="text-xs text-zinc-400 mt-1">Please enter your new administrator password below.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-400 font-semibold leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                New Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full h-11 pl-11 pr-11 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white placeholder-zinc-600 text-sm font-medium transition-all hover:border-white/[0.18] focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full h-11 pl-11 pr-4 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white placeholder-zinc-600 text-sm font-medium transition-all hover:border-white/[0.18] focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-bold text-sm shadow-[0_4px_20px_rgba(244,196,48,0.18)] hover:bg-amber-400 active:transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                  <span>Saving new password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          &copy; {new Date().getFullYear()} FusionFit Gym ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
