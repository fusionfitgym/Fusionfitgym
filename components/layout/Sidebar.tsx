'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ClipboardList,
  Dumbbell,
  FileSpreadsheet,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Settings,
  Tv,
  UserPlus,
  Users,
  X,
  MessageSquare,
  LogOut,
  Info,
  Download,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePwa } from '@/components/pwa/usePwa';
import IOSInstallPrompt from '@/components/pwa/IOSInstallPrompt';

interface ServerProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Receptionist' | 'Trainer';
  status: 'Active' | 'Suspended';
  created_at: string;
}

interface ServerUser {
  last_sign_in_at?: string | null;
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/attendance', label: 'Attendance', icon: Activity },
  { href: '/monitor', label: 'Live Monitor', icon: Tv },
  { href: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { href: '/health', label: 'Health Assessments', icon: HeartPulse },
  { href: '/parq', label: 'PAR-Q Forms', icon: ClipboardList },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/sms', label: 'SMS Logs', icon: MessageSquare },
  { href: '/users', label: 'User Management', icon: UserPlus },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/about', label: 'About', icon: Info },
];

function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/members/add') return pathname === '/members/add';
  if (href === '/members') {
    return pathname === '/members' || (pathname.startsWith('/members/') && pathname !== '/members/add');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        title={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors duration-150',
          collapsed ? 'justify-center px-3' : 'gap-3 px-3',
          active
            ? 'bg-amber-300 text-zinc-950 shadow-[0_8px_24px_rgba(244,196,48,0.18)]'
            : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

function NavContent({
  pathname,
  collapsed,
  onNavigate,
  onClose,
  serverProfile,
  serverUser,
  isInstallable,
  onInstall,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  serverProfile?: ServerProfile;
  serverUser?: ServerUser;
  isInstallable: boolean;
  onInstall: () => void;
}) {
  const { profile: authProfile, user: authUser, signOut } = useAuth();

  // Use server-provided profile immediately; fall back to AuthProvider
  const profile = serverProfile || authProfile;
  const lastSignInAt = serverUser?.last_sign_in_at ?? authUser?.last_sign_in_at;

  // Role-based route filtering
  const filteredItems = navItems.filter((item) => {
    if (item.href === '/about') return true;
    if (!profile) return false;
    const role = profile.role;
    
    if (role === 'Super Admin') return true;
    if (role === 'Admin') {
      return ['/', '/members', '/attendance', '/monitor', '/invoices', '/reports', '/sms', '/settings'].includes(item.href);
    }
    if (role === 'Receptionist') {
      return ['/', '/members', '/attendance', '/monitor', '/invoices'].includes(item.href);
    }
    if (role === 'Trainer') {
      return ['/', '/members', '/health', '/parq'].includes(item.href);
    }
    return false;
  });

  const finalItems = filteredItems;

  const getInitials = (name: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className={cn('flex h-20 items-center border-b border-white/[0.07]', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300 shadow-[0_6px_20px_rgba(244,196,48,0.2)]">
          <Dumbbell className="h-5 w-5 text-zinc-950" strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-white">FusionFit</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Gym management</p>
          </div>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" aria-label="Primary navigation">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">Workspace</p>
        )}
        <ul className="space-y-1">
          {finalItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isRouteActive(pathname, item.href)}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          ))}
        </ul>
      </nav>

      {/* User Profile Card Footer */}
      {profile && (
        <div className={cn('border-t border-white/[0.07] p-3 flex flex-col gap-3.5 bg-zinc-950/20', collapsed ? 'items-center' : '')}>
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 shrink-0 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 font-extrabold text-sm"
              title={collapsed ? profile.full_name : undefined}
            >
              {getInitials(profile.full_name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white leading-tight">{profile.full_name}</p>
                <span
                  className={cn(
                    'inline-block text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded mt-1.5',
                    profile.role === 'Super Admin'
                      ? 'bg-amber-300 text-zinc-950'
                      : profile.role === 'Admin'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : profile.role === 'Receptionist'
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
                  )}
                >
                  {profile.role}
                </span>
              </div>
            )}
          </div>

          {!collapsed && lastSignInAt && !isNaN(new Date(lastSignInAt).getTime()) && (
            <div className="text-[10px] text-zinc-500 font-medium leading-tight">
              Last login: <br />
              <span className="text-zinc-400 font-semibold mt-0.5 inline-block">
                {new Date(lastSignInAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {isInstallable && (
            <button
              onClick={onInstall}
              title="Install Web App"
              className={cn(
                'flex items-center justify-center text-zinc-950 bg-amber-300 hover:bg-amber-400 rounded-xl transition-all duration-150 cursor-pointer font-bold',
                collapsed
                  ? 'h-10 w-10 shadow-[0_4px_12px_rgba(244,196,48,0.2)]'
                  : 'w-full gap-2 px-3 py-2 text-xs shadow-[0_4px_12px_rgba(244,196,48,0.15)]',
              )}
            >
              <Download className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Install App</span>}
            </button>
          )}

          <button
            onClick={signOut}
            title="Sign out of system"
            className={cn(
              'flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-150 cursor-pointer',
              collapsed
                ? 'h-10 w-10 border border-white/[0.06] hover:border-red-500/25'
                : 'w-full gap-2 px-3 py-2 text-xs border border-white/[0.06] hover:border-red-500/20 font-semibold',
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      )}
    </>
  );
}

export default function Sidebar({
  serverProfile,
  serverUser,
}: {
  serverProfile?: ServerProfile;
  serverUser?: ServerUser;
} = {}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isInstallable, installApp, showIOSPrompt, closeIOSPrompt } = usePwa();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMobile();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeMobile]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <aside className="sticky top-0 z-40 hidden h-screen flex-col overflow-hidden border-r border-white/[0.07] bg-[#0b0d12] md:flex">
        <div className="hidden h-full w-full flex-col lg:flex">
          <NavContent
            pathname={pathname}
            serverProfile={serverProfile}
            serverUser={serverUser}
            isInstallable={isInstallable}
            onInstall={installApp}
          />
        </div>
        <div className="flex h-full w-full flex-col lg:hidden">
          <NavContent
            pathname={pathname}
            collapsed
            serverProfile={serverProfile}
            serverUser={serverUser}
            isInstallable={isInstallable}
            onInstall={installApp}
          />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/90 bg-white/90 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300">
            <Dumbbell className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-slate-950">FusionFit</p>
            <p className="text-[10px] font-medium text-slate-500">Gym management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isInstallable && (
            <button
              type="button"
              onClick={installApp}
              title="Install App"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-300 text-zinc-950 shadow-[0_4px_12px_rgba(244,196,48,0.2)] transition-transform active:scale-95 cursor-pointer"
            >
              <Download className="h-5 w-5 animate-bounce-slow" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/55 backdrop-blur-sm"
            onClick={closeMobile}
            aria-label="Close navigation"
          />
          <aside
            className="relative z-10 flex h-full w-[min(288px,86vw)] flex-col bg-[#0b0d12] shadow-2xl"
            style={{ animation: 'slide-in 180ms ease-out both' }}
          >
            <NavContent
              pathname={pathname}
              onNavigate={closeMobile}
              onClose={closeMobile}
              serverProfile={serverProfile}
              serverUser={serverUser}
              isInstallable={isInstallable}
              onInstall={installApp}
            />
          </aside>
        </div>
      )}

      <IOSInstallPrompt isOpen={showIOSPrompt} onClose={closeIOSPrompt} />
    </>
  );
}
