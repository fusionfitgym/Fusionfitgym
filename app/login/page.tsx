'use client';

import { useActionState, useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { signInAction, SignInState } from '@/lib/actions/auth';

const initialState: SignInState = {
  error: '',
  success: false,
};

function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get errors from URL query parameters (e.g. from middleware or redirects)
  const urlError = searchParams.get('error');
  const urlMessage = searchParams.get('message');

  useEffect(() => {
    if (state?.success) {
      router.push('/');
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-white px-4 relative overflow-hidden select-none">
      {/* Background Glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full filter blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 shadow-[0_8px_24px_rgba(244,196,48,0.25)] mb-4">
            <Dumbbell className="h-7 w-7 text-zinc-950" strokeWidth={2.4} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">FusionFit</h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-[0.2em] mt-1.5">Gym ERP Admin Portal</p>
        </div>

        {/* Card Body */}
        <div className="bg-[#121620] border border-white/[0.06] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Welcome back</h2>
            <p className="text-xs text-zinc-400 mt-1">Please sign in to manage members and services.</p>
          </div>

          {/* Success messages */}
          {urlMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-emerald-400 font-semibold leading-relaxed">
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{urlMessage}</span>
            </div>
          )}

          {/* Error messages */}
          {(state?.error || urlError) && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-400 font-semibold leading-relaxed">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{state?.error || urlError}</span>
            </div>
          )}

          <form action={formAction} className="space-y-5">
            {/* Hidden Input for Remember Me */}
            <input type="hidden" name="rememberMe" value={rememberMe ? 'true' : 'false'} />

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@fusionfit.com"
                  required
                  autoComplete="email"
                  disabled={isPending}
                  className="w-full h-11 pl-11 pr-4 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white placeholder-zinc-600 text-sm font-medium transition-all hover:border-white/[0.18] focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/10"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-amber-300 hover:text-amber-400 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 h-4 w-4 text-zinc-500 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  disabled={isPending}
                  className="w-full h-11 pl-11 pr-11 rounded-xl border border-white/[0.1] bg-white/[0.03] text-white placeholder-zinc-600 text-sm font-medium transition-all hover:border-white/[0.18] focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={isPending}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 h-7 w-7 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                disabled={isPending}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-white/[0.15] bg-white/[0.03] text-amber-400 focus:ring-amber-400/20 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2.5 text-xs font-semibold text-zinc-400 cursor-pointer select-none">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-300 text-zinc-950 font-bold text-sm shadow-[0_4px_20px_rgba(244,196,48,0.18)] hover:bg-amber-400 active:transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <span>Sign in to Dashboard</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-8">
          &copy; {new Date().getFullYear()} FusionFit Gym ERP. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0b0d12] text-white select-none">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
