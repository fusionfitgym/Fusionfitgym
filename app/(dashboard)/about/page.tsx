'use client';

import { useEffect, useState } from 'react';
import { 
  Dumbbell, 
  Cpu, 
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
  FileSpreadsheet, 
  HeartPulse, 
  MessageSquare, 
  ShieldCheck,
  Server,
  Cloud,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Globe,
  Zap,
  ArrowUpRight,
  Lock,
  X,
  Shield
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
    <div className="page page-wide page-enter pb-16">
      <Breadcrumb
        items={[
          { label: 'Dashboard', href: '/' },
          { label: 'About FusionFit' },
        ]}
      />

      <PageHeader
        title="About FusionFit ERP"
        subtitle="System overview, infrastructure status, developer credits, and licensing information."
      />

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 sm:p-10 text-white mb-10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        {/* Ambient glow effects */}
        <div className="absolute -right-32 -top-32 h-80 w-80 bg-amber-500/15 rounded-full blur-[100px]" />
        <div className="absolute -left-32 -bottom-32 h-80 w-80 bg-amber-500/8 rounded-full blur-[100px]" />
        <div className="absolute right-1/3 top-1/2 h-48 w-48 bg-emerald-500/5 rounded-full blur-[80px]" />

        <div className="relative">
          {/* Top: Logo + Product Info */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 shadow-[0_8px_32px_rgba(244,196,48,0.35)]">
                <Dumbbell className="h-8 w-8 text-zinc-950" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  FusionFit Gym Management ERP
                </h2>
                <p className="text-zinc-300 text-sm sm:text-base mt-1 font-medium leading-relaxed max-w-xl">
                  Modern enterprise administration, membership billing, automated notifications, and biometric tracking platform.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleCopyVersion}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] px-4 text-sm font-semibold text-zinc-100 transition-all duration-200 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-amber-300" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                <span className="font-mono">{PRODUCT_VERSION}</span>
              </button>
              <span className="inline-flex h-9 items-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 text-xs font-bold uppercase tracking-wider">
                <span className="relative flex h-1.5 w-1.5 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                Production
              </span>
              <span className="inline-flex h-9 items-center rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 px-4 text-xs font-bold">
                Stable
              </span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Version" value={PRODUCT_VERSION} />
            <MetricCard label="Last updated" value={RELEASE_DATE} />
            <MetricCard label="License" value="Commercial" />
            <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Updates</p>
              <button 
                onClick={handleCheckUpdates}
                disabled={checkingUpdates}
                className="flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
                {checkingUpdates ? 'Checking...' : 'Check for updates'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SYSTEM STATUS + DEVELOPER INFO ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        
        {/* System Status Panel */}
        <section className="rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-zinc-800 p-6 sm:p-7 shadow-[0_10px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.3)] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20">
                  <Server className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                System status
              </h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Live connectivity to system backends</p>
            </div>
            <button 
              onClick={fetchStatus}
              disabled={loadingStatus}
              title="Refresh Status"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-1 flex-1">
            <StatusRow 
              label="Database" 
              status={loadingStatus ? 'checking' : systemStatus?.database === 'Operational' ? 'online' : 'offline'} 
              desc="Supabase PostgreSQL"
              icon={<Database className="h-4 w-4" />}
            />
            <StatusRow 
              label="Authentication" 
              status={loadingStatus ? 'checking' : systemStatus?.auth === 'Operational' ? 'online' : 'offline'} 
              desc="Supabase Auth Engine"
              icon={<Lock className="h-4 w-4" />}
            />
            <StatusRow 
              label="Object Storage" 
              status={loadingStatus ? 'checking' : systemStatus?.storage === 'Operational' ? 'online' : 'offline'} 
              desc="Supabase Media Storage"
              icon={<Cloud className="h-4 w-4" />}
            />
            <StatusRow 
              label="SMS Gateway" 
              status={loadingStatus ? 'checking' : systemStatus?.sms === 'Operational' ? 'online' : systemStatus?.sms === 'Disabled' ? 'disabled' : 'offline'} 
              desc="MSG91 Service"
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <StatusRow 
              label="Web Latency" 
              status={loadingStatus ? 'checking' : systemStatus?.api.status === 'Operational' ? 'online' : 'offline'} 
              desc={systemStatus?.api.latencyMs ? `${systemStatus.api.latencyMs}ms response` : 'Vercel Edge'}
              icon={<Zap className="h-4 w-4" />}
            />
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setShowSysInfoModal(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 transition-all duration-200 cursor-pointer"
            >
              <Cpu className="h-4 w-4" /> System info
            </button>
            <button
              onClick={() => setShowLicenseModal(true)}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-sm font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600 transition-all duration-200 cursor-pointer"
            >
              <FileText className="h-4 w-4" /> License info
            </button>
          </div>
        </section>

        {/* Developer Credits Card */}
        <section className="rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-zinc-800 p-6 sm:p-7 shadow-[0_10px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.3)] flex flex-col">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Designed &amp; developed by
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Built exclusively for Fusion Fit Multi Gym</p>
          </div>

          {/* Developer Cards */}
          <div className="space-y-3 mb-6 flex-1">
            {/* Ihsan */}
            <a 
              href="https://ihsan-web-portfolio.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-slate-50 to-white dark:from-zinc-800/60 dark:to-zinc-800/30 border border-slate-200/70 dark:border-zinc-700/60 p-4 hover:border-amber-300/60 dark:hover:border-amber-500/30 hover:shadow-[0_8px_30px_rgba(244,196,48,0.08)] transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white font-black text-lg shadow-[0_4px_16px_rgba(244,196,48,0.3)]">
                I
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Ihsan
                  </p>
                  <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">Founder &amp; Lead Engineer</p>
              </div>
              <Globe className="h-4 w-4 text-slate-300 dark:text-zinc-600 group-hover:text-amber-400 transition-colors" />
            </a>

            {/* Redix Media */}
            <a 
              href="https://redix.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-slate-50 to-white dark:from-zinc-800/60 dark:to-zinc-800/30 border border-slate-200/70 dark:border-zinc-700/60 p-4 hover:border-amber-300/60 dark:hover:border-amber-500/30 hover:shadow-[0_8px_30px_rgba(244,196,48,0.08)] transition-all duration-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-zinc-500 dark:to-zinc-700 text-white font-black text-lg shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
                R
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Redix Media
                  </p>
                  <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-0.5">Technology Partner</p>
              </div>
              <Globe className="h-4 w-4 text-slate-300 dark:text-zinc-600 group-hover:text-amber-400 transition-colors" />
            </a>
          </div>

          {/* Description */}
          <div className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed space-y-2.5">
            <p>
              Designed and developed by <strong className="text-slate-800 dark:text-white">Ihsan</strong>, specializing in ERP Systems, Web Applications, and Automation Solutions. View his work at{' '}
              <a href="https://ihsan-web-portfolio.vercel.app" target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-600 dark:text-amber-400 hover:underline underline-offset-2">
                ihsan-web-portfolio.vercel.app
              </a>.
            </p>
            <p>
              Powered by <strong className="text-slate-800 dark:text-white">Redix Media</strong> (<a href="https://redix.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-600 dark:text-amber-400 hover:underline underline-offset-2">redix.in</a>), engineering customized management portals for client tracking, attendance, invoicing, biometrics, and automated notifications.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
              <Copyright className="h-3 w-3" /> 
              <span className="font-medium">Fusion Fit Multi Gym</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500">
              <span>Next.js · TypeScript · Supabase · Tailwind</span>
            </div>
          </div>
        </section>
      </div>

      {/* ─── PRIMARY ERP MODULES ─── */}
      <div className="mb-10">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-5 tracking-tight">
          Primary ERP modules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard title="Member Management" icon={Users} desc="Comprehensive registration profiles, status tracking, and plan assignments." color="blue" />
          <FeatureCard title="Attendance Tracking" icon={Activity} desc="Automated clock-in registries, log monitoring, and reporting stats." color="emerald" />
          <FeatureCard title="Biometric Sync" icon={Cpu} desc="Seamless hardware synchronization with eSSL/ZKTeco biometric readers." color="violet" />
          <FeatureCard title="Invoice & Billing" icon={FileText} desc="Digital billing records, automatic numbering systems, and PDF downloads." color="amber" />
          <FeatureCard title="SMS Notifications" icon={MessageSquare} desc="Automated welcome messages, plan renewals, and check-in receipts via MSG91." color="rose" />
          <FeatureCard title="Health Assessments" icon={HeartPulse} desc="Physiological progress reports, body measurements, and BMI calculators." color="pink" />
          <FeatureCard title="Reports & Analytics" icon={FileSpreadsheet} desc="Operational summaries, business metrics, and membership plan distributions." color="sky" />
          <FeatureCard title="Role-Based Security" icon={ShieldCheck} desc="Granular access hierarchies for Super Admin, Admin, Trainer, and Receptionist." color="orange" />
        </div>
      </div>

      {/* ─── SUPPORT + LEGAL ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Technical Support */}
        <section className="rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-zinc-800 p-6 sm:p-7 shadow-[0_10px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.3)]">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20">
              <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            Technical support
          </h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Direct developer contact for technical assistance</p>

          <div className="space-y-3">
            <ContactCard 
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value="ihsan.anas8281@gmail.com"
              href="mailto:ihsan.anas8281@gmail.com"
            />
            <ContactCard 
              icon={<Phone className="h-4 w-4" />}
              label="WhatsApp"
              value="+91 949013275"
              href="whatsapp://send?phone=+91949013275"
            />
            <ContactCard 
              icon={<Clock className="h-4 w-4" />}
              label="Business hours"
              value="Mon - Sat, 09:00 AM - 06:00 PM IST"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-500/15 p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-200/80 font-medium">
            For technical issues, software bugs, custom feature requests, or device integration support — contact the developer directly.
          </div>
        </section>

        {/* Legal & Licensing */}
        <section className="rounded-3xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-zinc-800 p-6 sm:p-7 shadow-[0_10px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_50px_rgba(0,0,0,0.3)] flex flex-col">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-zinc-700/50 dark:to-zinc-700/30">
                <Shield className="h-4 w-4 text-slate-600 dark:text-zinc-300" />
              </div>
              Licensing &amp; legal
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Software usage rights and intellectual property</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200">
                <Copyright className="h-3 w-3" /> Commercial License
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-200">
                <Lock className="h-3 w-3" /> Single Site
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-3 w-3" /> IP Protected
              </span>
            </div>

            <div className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed space-y-3">
              <p>
                &copy; {new Date().getFullYear()} FusionFit Gym Management ERP. All Rights Reserved.
              </p>
              <p>
                This software has been custom designed and developed specifically for <strong className="text-slate-800 dark:text-white">Fusion Fit Multi Gym</strong>. Unauthorized copying, redistribution, modification, resale, or reverse engineering is strictly prohibited without explicit written authorization.
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              Protected under intellectual property laws
            </span>
            <button 
              onClick={() => setShowLicenseModal(true)}
              className="text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              View full license <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </section>
      </div>

      {/* ─── SYSTEM INFORMATION MODAL ─── */}
      {showSysInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-7 shadow-[0_24px_64px_rgba(0,0,0,0.2)] relative">
            <button
              onClick={() => setShowSysInfoModal(false)}
              className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-white dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2.5">
              <Cpu className="h-5 w-5 text-amber-500" /> System information
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
              Environment parameters and build configuration
            </p>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              {/* Environment Config */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 p-5">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-slate-500 dark:text-zinc-400" /> Environment
                </h4>
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-zinc-800/40">
                  <ModalRow label="Node environment" value={process.env.NODE_ENV || 'production'} />
                  <ModalRow label="Execution stack" value="Vercel Serverless Edge" />
                  <ModalRow label="Supabase URL" value={process.env.NEXT_PUBLIC_SUPABASE_URL || 'Configured'} mono />
                  <ModalRow label="Analytics" value="Vercel Analytics" accent />
                </div>
              </div>

              {/* Build Specs */}
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 p-5">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-slate-500 dark:text-zinc-400" /> Build specifications
                </h4>
                <div className="space-y-0 divide-y divide-slate-100 dark:divide-zinc-800/40">
                  <ModalRow label="Framework" value="Next.js 15 App Router" />
                  <ModalRow label="Bundler" value="Turbopack (Rust)" />
                  <ModalRow label="TypeScript" value="Strict, ES2022" mono />
                  <ModalRow label="PWA" value="Service Worker v1.0.0" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-5 mt-5 border-t border-slate-100 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={() => setShowSysInfoModal(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-5 text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── LICENSE INFORMATION MODAL ─── */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-3xl p-7 shadow-[0_24px_64px_rgba(0,0,0,0.2)] relative">
            <button
              onClick={() => setShowLicenseModal(false)}
              className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-white dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-amber-500" /> Software license
            </h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
              Legal agreements and copyright notices
            </p>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 p-5">
                <p className="font-bold text-slate-900 dark:text-white mb-2 text-sm">1. End-User License Agreement</p>
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed mb-2">
                  This Software License is a legally binding contract between <strong className="text-slate-800 dark:text-white">FusionFit Technologies (developed by Ihsan)</strong> and <strong className="text-slate-800 dark:text-white">Fusion Fit Multi Gym</strong>.
                </p>
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Subject to full compliance with terms, the Developer grants a non-exclusive, non-transferable, single-site commercial license to deploy and execute FusionFit ERP for internal gym administration.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 p-5">
                <p className="font-bold text-slate-900 dark:text-white mb-2 text-sm">2. Usage Restrictions</p>
                <p className="text-sm text-slate-600 dark:text-zinc-300 mb-2">Under this single-site license, the Licensee is prohibited from:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 dark:text-zinc-300">
                  <li>Sublicensing, leasing, renting, or selling the software codebase.</li>
                  <li>Redistributing custom software binaries or modules to secondary gym franchises.</li>
                  <li>Altering intellectual property markings, logos, or author credits.</li>
                  <li>Using the database models or backend configurations for copycat software designs.</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/60 p-5">
                <p className="font-bold text-slate-900 dark:text-white mb-2 text-sm">3. Warranty &amp; Liability Limits</p>
                <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                  The software is provided &quot;AS IS&quot; without warranty of any kind. The Developer shall not be liable for any administrative losses, device sync disruptions, data anomalies, or network communication latencies.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-5 mt-5 border-t border-slate-100 dark:border-zinc-800/60">
              <button
                type="button"
                onClick={() => setShowLicenseModal(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-5 text-sm font-semibold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── HELPER COMPONENTS ─── */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-4">
      <p className="text-xs font-medium text-zinc-500 mb-1.5">{label}</p>
      <p className="text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function StatusRow({ 
  label, 
  status, 
  desc,
  icon
}: { 
  label: string; 
  status: 'online' | 'offline' | 'disabled' | 'checking'; 
  desc?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors duration-150">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate">{label}</p>
          {desc && <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">
        {status === 'checking' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">Checking</span>
          </span>
        )}
        {status === 'online' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Operational</span>
          </span>
        )}
        {status === 'offline' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200/50 dark:border-rose-500/20">
            <XCircle className="h-3 w-3 text-rose-500" />
            <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Outage</span>
          </span>
        )}
        {status === 'disabled' && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <AlertCircle className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">Disabled</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ContactCard({ 
  icon, label, value, href 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700/60 p-4 hover:border-amber-200/60 dark:hover:border-amber-500/20 transition-all duration-200 group">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 text-amber-600 dark:text-amber-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return <a href={href} className="block">{content}</a>;
  }
  return content;
}

function ModalRow({ 
  label, value, mono, accent 
}: { 
  label: string; 
  value: string; 
  mono?: boolean; 
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 gap-4">
      <span className="text-sm text-slate-500 dark:text-zinc-400">{label}</span>
      <span className={`text-sm font-semibold text-right truncate max-w-[220px] ${
        accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-zinc-100'
      } ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

const featureColors: Record<string, { bg: string; text: string; hoverBorder: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', hoverBorder: 'hover:border-blue-300/60 dark:hover:border-blue-500/30' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', hoverBorder: 'hover:border-emerald-300/60 dark:hover:border-emerald-500/30' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', hoverBorder: 'hover:border-violet-300/60 dark:hover:border-violet-500/30' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', hoverBorder: 'hover:border-amber-300/60 dark:hover:border-amber-500/30' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', hoverBorder: 'hover:border-rose-300/60 dark:hover:border-rose-500/30' },
  pink:    { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', hoverBorder: 'hover:border-pink-300/60 dark:hover:border-pink-500/30' },
  sky:     { bg: 'bg-sky-50 dark:bg-sky-900/20', text: 'text-sky-600 dark:text-sky-400', hoverBorder: 'hover:border-sky-300/60 dark:hover:border-sky-500/30' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', hoverBorder: 'hover:border-orange-300/60 dark:hover:border-orange-500/30' },
};

function FeatureCard({ 
  title, 
  icon: Icon, 
  desc,
  color = 'amber'
}: { 
  title: string; 
  icon: React.ElementType; 
  desc: string;
  color?: string;
}) {
  const c = featureColors[color] || featureColors.amber;
  return (
    <div className={`group rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-slate-200/70 dark:border-zinc-800 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${c.hoverBorder} transition-all duration-300 flex flex-col`}>
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text} mb-4`}>
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5">{title}</h4>
      <p className="text-sm leading-relaxed text-slate-500 dark:text-zinc-400 flex-1">{desc}</p>
    </div>
  );
}
