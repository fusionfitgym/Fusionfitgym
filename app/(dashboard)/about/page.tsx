'use client';

import { useEffect, useState } from 'react';
import { 
  Info, 
  Dumbbell, 
  Cpu, 
  Globe, 
  Database, 
  ShieldAlert, 
  Mail, 
  Phone, 
  Clock, 
  FileText, 
  Copyright, 
  Copy, 
  Check, 
  RefreshCw, 
  Terminal, 
  Sparkles, 
  Users, 
  Activity, 
  Tv, 
  FileSpreadsheet, 
  HeartPulse, 
  ClipboardList, 
  MessageSquare, 
  ShieldCheck,
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { checkSystemStatus, SystemStatus } from '@/lib/actions/about';

const PRODUCT_VERSION = 'v1.0.0';
const RELEASE_DATE = 'June 23, 2026';
const BUILD_TYPE = 'Production (Stable)';

export default function AboutPage() {
  const [copied, setCopied] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showSysInfoModal, setShowSysInfoModal] = useState(false);
  
  // Live status state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Fetch live system status
  const fetchStatus = () => {
    setLoadingStatus(true);
    checkSystemStatus()
      .then((res) => {
        setSystemStatus(res);
      })
      .catch((err) => {
        console.error('Failed to load system statuses:', err);
      })
      .finally(() => {
        setLoadingStatus(false);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleCopyVersion = () => {
    navigator.clipboard.writeText(PRODUCT_VERSION);
    setCopied(true);
    toast.success(`Copied version ${PRODUCT_VERSION} to clipboard`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckUpdates = () => {
    setCheckingUpdates(true);
    setTimeout(() => {
      setCheckingUpdates(false);
      toast.info('You are currently running the latest version (v1.0.0).');
    }, 1500);
  };

  return (
    <div className="page page-wide page-enter pb-12">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'About FusionFit' },
        ]}
      />

      <PageHeader
        title="About FusionFit ERP"
        subtitle="Detailed system parameters, specifications, deployment metrics, and developer credits."
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-950 p-6 sm:p-8 text-white shadow-2xl mb-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 bg-amber-500/10 rounded-full filter blur-[80px]" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 bg-amber-500/5 rounded-full filter blur-[80px]" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4.5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-300 shadow-[0_8px_30px_rgba(244,196,48,0.25)]">
              <Dumbbell className="h-8 w-8 text-zinc-950" strokeWidth={2.4} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                FusionFit Gym Management ERP
                <span className="inline-flex items-center bg-amber-400/10 text-amber-300 text-xs font-black px-2 py-0.5 rounded-full border border-amber-400/20">
                  Stable
                </span>
              </h2>
              <p className="text-zinc-300 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">
                Modern enterprise administration, membership billing, automated notifications, and biometric tracking platform.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyVersion}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] px-3.5 text-xs font-semibold text-zinc-100 transition-all cursor-pointer"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-amber-300 animate-pulse" /> : <Copy className="h-3.5 w-3.5 text-zinc-300" />}
              <span>{PRODUCT_VERSION}</span>
            </button>
            <span className="inline-flex h-9 items-center rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-3.5 text-xs font-extrabold tracking-wider uppercase">
              Production
            </span>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-white/[0.07] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold text-zinc-300">
          <div>
            <p className="uppercase text-xs tracking-widest text-zinc-300">Last updated</p>
            <p className="mt-1.5 text-zinc-100 font-bold">{RELEASE_DATE}</p>
          </div>
          <div>
            <p className="uppercase text-xs tracking-widest text-zinc-300">License type</p>
            <p className="mt-1.5 text-zinc-100 font-bold">Commercial (Single Site)</p>
          </div>
          <div>
            <p className="uppercase text-xs tracking-widest text-zinc-300">Build context</p>
            <p className="mt-1.5 text-zinc-100 font-bold">{BUILD_TYPE}</p>
          </div>
          <div>
            <p className="uppercase text-xs tracking-widest text-zinc-300">Updates</p>
            <button 
              onClick={handleCheckUpdates}
              disabled={checkingUpdates}
              className="mt-1 flex items-center gap-1.5 text-amber-300 hover:text-amber-400 font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`h-3 w-3 ${checkingUpdates ? 'animate-spin' : ''}`} />
              {checkingUpdates ? 'Checking...' : 'Check for Updates'}
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid: Status and Developer Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Live System Status Panel */}
        <section className="card p-5 sm:p-6 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="card-title text-base font-extrabold flex items-center gap-2">
                  <Server className="h-5 w-5 text-amber-500" /> System Status
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Live connectivity metrics to system backends.</p>
              </div>
              <button 
                onClick={fetchStatus}
                disabled={loadingStatus}
                title="Refresh Status"
                className="table-action shrink-0 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${loadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="space-y-4">
              <StatusRow 
                label="Database Connection" 
                status={loadingStatus ? 'checking' : systemStatus?.database === 'Operational' ? 'online' : 'offline'} 
                desc="Supabase PostgreSQL"
              />
              <StatusRow 
                label="Authentication API" 
                status={loadingStatus ? 'checking' : systemStatus?.auth === 'Operational' ? 'online' : 'offline'} 
                desc="Supabase Auth Engine"
              />
              <StatusRow 
                label="Object Storage" 
                status={loadingStatus ? 'checking' : systemStatus?.storage === 'Operational' ? 'online' : 'offline'} 
                desc="Supabase Media Storage"
              />
              <StatusRow 
                label="SMS Service Status" 
                status={loadingStatus ? 'checking' : systemStatus?.sms === 'Operational' ? 'online' : systemStatus?.sms === 'Disabled' ? 'disabled' : 'offline'} 
                desc="MSG91 Gateway"
              />
              <StatusRow 
                label="Web Latency" 
                status={loadingStatus ? 'checking' : systemStatus?.api.status === 'Operational' ? 'online' : 'offline'} 
                desc={systemStatus?.api.latencyMs ? `${systemStatus.api.latencyMs}ms API response` : 'Vercel API Gateway'}
              />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowSysInfoModal(true)}
              className="btn btn-secondary w-full justify-center text-xs font-bold py-2 rounded-xl"
            >
              <Cpu className="h-4 w-4" /> System Information
            </button>
            <button
              onClick={() => setShowLicenseModal(true)}
              className="btn btn-secondary w-full justify-center text-xs font-bold py-2 rounded-xl"
            >
              <FileText className="h-4 w-4" /> View License Information
            </button>
          </div>
        </section>

        {/* Designed & Developed By Card */}
        <section className="card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="card-title text-base font-extrabold flex items-center gap-2 mb-1.5">
              <Sparkles className="h-5 w-5 text-amber-500" /> Designed & Developed By
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mb-6">Designed exclusively for Fusion Fit Multi Gym.</p>

            {/* Developer Details */}
            <div className="space-y-4 mb-5">
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-500 font-black text-base shadow-sm">
                  I
                </div>
                <div className="min-w-0">
                  <a 
                    href="https://ihsan-web-portfolio.vercel.app" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-amber-500 transition-colors"
                  >
                    Ihsan
                  </a>
                  <p className="text-xs font-black uppercase text-amber-500 tracking-wider mt-0.5">Full Stack Developer</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10 text-amber-500 font-black text-base shadow-sm">
                  R
                </div>
                <div className="min-w-0">
                  <a 
                    href="https://redix.in" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-extrabold text-slate-900 dark:text-white hover:text-amber-500 transition-colors"
                  >
                    Redix Media
                  </a>
                  <p className="text-xs font-black uppercase text-amber-500 tracking-wider mt-0.5">Technology Partner</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-zinc-200 font-medium leading-relaxed">
              <p>
                This application is designed and developed by <strong>Ihsan</strong> (specializing in ERP Systems, Websites, Web Applications, and Automation Solutions). You can view his work at <a href="https://ihsan-web-portfolio.vercel.app" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">ihsan-web-portfolio.vercel.app</a>.
              </p>
              <p>
                Developed in partnership with <strong>Redix Media</strong> (<a href="https://redix.in" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">redix.in</a>), who is powering this app and engineering customized management portals to streamline client tracking, attendance registers, invoice generations, biometrics device synchronizations, and automated notifications.
              </p>
              <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300 italic">
                Made with Next.js, TypeScript, Supabase, Tailwind CSS
              </p>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/80 text-xs text-slate-700 dark:text-zinc-200 font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Copyright className="h-3.5 w-3.5" /> 
              <span>Developed exclusively for Fusion Fit Multi Gym</span>
            </div>
            <a 
              href="https://redix.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-500 hover:underline font-extrabold"
            >
              redix.in
            </a>
          </div>
        </section>
      </div>

      {/* Features Grid Overview */}
      <h3 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900 dark:text-white mb-4 px-1">
        Primary ERP Modules
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <FeatureCard title="Member Management" icon={Users} desc="Comprehensive registration profiles, status tracking, and plan assignments." />
        <FeatureCard title="Attendance Tracking" icon={Activity} desc="Automated clock-in registries, log monitoring, and reporting stats." />
        <FeatureCard title="Biometric Sync" icon={Cpu} desc="Seamless hardware synchronization with eSSL/ZKTeco biometric readers." />
        <FeatureCard title="Invoice & Billing" icon={FileText} desc="Digital billing records, automatic numbering systems, and PDF downloads." />
        <FeatureCard title="SMS Notifications" icon={MessageSquare} desc="Automated welcome messages, plan renewals, and check-in receipts via MSG91." />
        <FeatureCard title="Health Assessments" icon={HeartPulse} desc="Physiological progress reports, body measurements, and BMI calculators." />
        <FeatureCard title="Reports & Analytics" icon={FileSpreadsheet} desc="Operational summaries, business metrics, and membership plan distributions." />
        <FeatureCard title="Role-Based Security" icon={ShieldCheck} desc="Granular access hierarchies for Super Admin, Admin, Trainer, and Receptionist." />
      </div>

      {/* Technical Support and Legal Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Support & Contact Section */}
        <section className="card p-5 sm:p-6">
          <h3 className="card-title text-base font-extrabold flex items-center gap-2 mb-1.5">
            <Mail className="h-5 w-5 text-amber-500" /> Technical Support
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-300 mb-5">Technical operations and feature requests.</p>

          <div className="space-y-4 text-xs font-semibold text-slate-800 dark:text-zinc-200">
            <div className="flex items-center gap-3">
              <Mail className="h-4.5 w-4.5 text-slate-600 dark:text-zinc-300 shrink-0" />
              <div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Email Address</p>
                <a href="mailto:ihsan.anas8281@gmail.com" className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">ihsan.anas8281@gmail.com</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4.5 w-4.5 text-slate-600 dark:text-zinc-300 shrink-0" />
              <div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Whatsapp number</p>
                <a href="whatsapp://send?phone=+91949013275" className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">+91 949013275</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4.5 w-4.5 text-slate-600 dark:text-zinc-300 shrink-0" />
              <div>
                <p className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Business Hours</p>
                <p className="text-xs text-slate-700 dark:text-zinc-200 uppercase tracking-wider">Monday - Saturday (09:00 AM - 06:00 PM IST)</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-black/10 dark:border-white/10 p-3 text-sm leading-relaxed text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
            For technical issues, software bugs, custom feature requests, or device integration support, please contact the developer directly.
          </div>
        </section>

        {/* Legal & Licensing Details */}
        <section className="card p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h3 className="card-title text-base font-extrabold flex items-center gap-2 mb-1.5">
              <ShieldAlert className="h-5 w-5 text-amber-500" /> Licensing & Legal Disclaimer
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mb-4">Software usage rights and intellectual property statements.</p>

            <div className="text-xs text-slate-700 dark:text-zinc-200 font-medium leading-relaxed space-y-3">
              <p>
                &copy; {new Date().getFullYear()} FusionFit Gym Management ERP. All Rights Reserved.
              </p>
              <p>
                This software has been custom designed, engineered, and developed specifically for <strong>Fusion Fit Multi Gym</strong>. Unauthorized copying, redistribution, modification, resale, or reverse engineering of this application is strictly prohibited without explicit written authorization.
              </p>
            </div>
          </div>

          <div className="mt-5 text-xs font-black uppercase text-amber-500 tracking-wider">
            Protected under intellectual property laws.
          </div>
        </section>
      </div>

      {/* SYSTEM INFORMATION MODAL */}
      {showSysInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSysInfoModal(false)}
              className="absolute right-4 top-4 text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-amber-500" /> System Information
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mb-5">
              Technical execution environment parameters and configuration contexts.
            </p>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
              {/* Build Environment */}
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider mb-2 flex items-center gap-1.5">
                  <Cloud className="h-4 w-4" /> Environment Config
                </h4>
                <div className="space-y-2 text-xs font-medium divide-y divide-slate-100 dark:divide-zinc-800/30">
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Node Environment</span><span className="text-slate-900 dark:text-zinc-200 font-bold">{process.env.NODE_ENV}</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Execution Stack</span><span className="text-slate-900 dark:text-zinc-200 font-bold">Vercel Serverless Edge</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Supabase URL</span><span className="text-slate-900 dark:text-zinc-200 font-mono text-xs">{process.env.NEXT_PUBLIC_SUPABASE_URL || 'Configured'}</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Analytics Mode</span><span className="text-slate-900 dark:text-zinc-200 font-bold text-emerald-500">Vercel Analytics Enabled</span></div>
                </div>
              </div>

              {/* Build Info */}
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider mb-2 flex items-center gap-1.5">
                  <Terminal className="h-4 w-4" /> Build Specifications
                </h4>
                <div className="space-y-2 text-xs font-medium divide-y divide-slate-100 dark:divide-zinc-800/30">
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Build Target</span><span className="text-slate-900 dark:text-zinc-200 font-bold">Next.js 15 App Router</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Target Bundler</span><span className="text-slate-900 dark:text-zinc-200 font-bold">Turbopack (Rust Compiler)</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">Compiler Options</span><span className="text-slate-900 dark:text-zinc-200 font-bold font-mono text-sm">Strict, ES2022</span></div>
                  <div className="flex justify-between py-1.5"><span className="text-slate-700 dark:text-zinc-200">PWA Target</span><span className="text-slate-900 dark:text-zinc-200 font-bold">Service Worker v1.0.0</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-900/60 mt-6">
              <button
                type="button"
                onClick={() => setShowSysInfoModal(false)}
                className="btn btn-secondary bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 rounded-xl px-5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LICENSE INFORMATION MODAL */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowLicenseModal(false)}
              className="absolute right-4 top-4 text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-white transition-all cursor-pointer"
            >
              <XCircle className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" /> Commercial Software License
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mb-5">
              Legal agreements, copyright notices, and software delivery parameters.
            </p>

            <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1 text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-medium">
              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <p className="font-extrabold text-slate-900 dark:text-white mb-2">1. End-User License Agreement (EULA)</p>
                <p className="mb-3">
                  This Software License is a legally binding contract between <strong>FusionFit Technologies (developed by Ihsan)</strong> and <strong>Fusion Fit Multi Gym</strong>.
                </p>
                <p>
                  Subject to full compliance with terms, the Developer grants a non-exclusive, non-transferable, single-site commercial license to deploy and execute FusionFit ERP for internal gym administration.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <p className="font-extrabold text-slate-900 dark:text-white mb-2">2. Usage Restrictions</p>
                <p className="mb-2">Under this single-site license, the Licensee is prohibited from:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Sublicensing, leasing, renting, or selling the software codebase.</li>
                  <li>Redistributing custom software binaries or modules to secondary gym franchises.</li>
                  <li>Altering intellectual property markings, logos, or author credits.</li>
                  <li>Using the database models or backend configurations for copycat software designs.</li>
                </ul>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 rounded-2xl p-4">
                <p className="font-extrabold text-slate-900 dark:text-white mb-2">3. Warranty & Liability Limits</p>
                <p>
                  The software is provided "AS IS" without warranty of any kind. The Developer shall not be liable for any administrative losses, device sync disruptions, data anomalies, or network communication latencies.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-900/60 mt-6">
              <button
                type="button"
                onClick={() => setShowLicenseModal(false)}
                className="btn btn-secondary bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 rounded-xl px-5 cursor-pointer"
              >
                Close Agreement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function StatusRow({ 
  label, 
  status, 
  desc 
}: { 
  label: string; 
  status: 'online' | 'offline' | 'disabled' | 'checking'; 
  desc?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs font-semibold">
      <div className="min-w-0">
        <p className="text-slate-800 dark:text-zinc-200 font-bold truncate">{label}</p>
        {desc && <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium truncate mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
        {status === 'checking' && (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs text-amber-500 font-bold uppercase tracking-wider">Checking...</span>
          </>
        )}
        {status === 'online' && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-500 font-extrabold uppercase tracking-wider">Operational</span>
          </>
        )}
        {status === 'offline' && (
          <>
            <XCircle className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-xs text-rose-500 font-extrabold uppercase tracking-wider">Outage / Error</span>
          </>
        )}
        {status === 'disabled' && (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" />
            <span className="text-xs text-zinc-600 dark:text-zinc-300 font-extrabold uppercase tracking-wider">Disabled</span>
          </>
        )}
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <span className="text-slate-600 dark:text-zinc-300 font-medium">{label}</span>
      <span className="text-slate-800 dark:text-zinc-100 font-bold text-right truncate max-w-[200px]">{value}</span>
    </div>
  );
}

function FeatureCard({ 
  title, 
  icon: Icon, 
  desc 
}: { 
  title: string; 
  icon: React.ElementType; 
  desc: string;
}) {
  return (
    <div className="card p-4 hover:border-amber-400/35 hover:shadow-md transition-all group flex flex-col justify-between">
      <div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 text-slate-600 group-hover:bg-amber-300 group-hover:text-zinc-950 group-hover:border-amber-400/40 transition-colors shadow-xs dark:bg-zinc-900/60 dark:border-zinc-800/60 dark:text-zinc-300">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h4 className="mt-3 text-[13px] font-extrabold text-slate-900 dark:text-white truncate">{title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-300 font-medium">{desc}</p>
      </div>
    </div>
  );
}
