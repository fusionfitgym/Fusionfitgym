'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ClipboardList,
  Dumbbell,
  FileSpreadsheet,
  FileText,
  HardHat,
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
  Cpu,
  Database,
  ChevronDown,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { toast } from 'sonner';
import { usePwa } from '@/components/pwa/usePwa';
import IOSInstallPrompt from '@/components/pwa/IOSInstallPrompt';
import { getPendingSMSCount } from '@/lib/actions/sms';

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
  {
    label: 'Personal Training',
    icon: Dumbbell,
    children: [
      { href: '/pt', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/pt/members', label: 'PT Members', icon: Users },
      { href: '/pt/packages', label: 'PT Packages', icon: ClipboardList },
      { href: '/pt/trainers', label: 'Trainers', icon: HardHat },
      { href: '/pt/schedule', label: 'Session Schedule', icon: Activity },
      { href: '/pt/attendance', label: 'Attendance', icon: Activity },
      { href: '/pt/payments', label: 'Payments', icon: FileText },
      { href: '/pt/invoices', label: 'Invoices', icon: FileSpreadsheet },
      { href: '/pt/reports', label: 'Reports', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'Staff',
    icon: HardHat,
    children: [
      { href: '/staff', label: 'Staff List', icon: HardHat },
      { href: '/staff/attendance', label: 'Staff Attendance', icon: Activity },
    ],
  },
  { href: '/attendance', label: 'Attendance', icon: Activity },
  { href: '/monitor', label: 'Live Monitor', icon: Tv },
  {
    label: 'Device Management',
    icon: Cpu,
    children: [
      { href: '/devices', label: 'Device Status', icon: Cpu },
      { href: '/devices/command-center', label: 'Command Center', icon: Activity },
      { href: '/devices/inspector', label: 'Device Inspector', icon: ClipboardList },
    ],
  },
  { href: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { href: '/health', label: 'Health Assessments', icon: HeartPulse },
  { href: '/parq', label: 'PAR-Q Forms', icon: ClipboardList },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/sms', label: 'SMS Hub', icon: MessageSquare },
  { href: '/users', label: 'User Management', icon: UserPlus },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/backup', label: 'Backup', icon: Database },
  { href: '/about', label: 'About', icon: Info },
];

function isRouteActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/members/add') return pathname === '/members/add';
  if (href === '/members') {
    return pathname === '/members' || (pathname.startsWith('/members/') && pathname !== '/members/add');
  }
  if (href === '/staff') {
    return pathname === '/staff' || pathname.startsWith('/staff/');
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
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  badge?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        prefetch={true}
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
        {!collapsed && badge !== undefined && badge > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
            🔔 {badge}
          </span>
        )}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-zinc-950">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
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
  const [pendingSmsCount, setPendingSmsCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const loadPending = () => {
      getPendingSMSCount()
        .then((count) => {
          if (mounted) setPendingSmsCount(count);
        })
        .catch(() => {});
    };
    loadPending();
    
    window.addEventListener('sms-count-changed', loadPending);

    const interval = window.setInterval(loadPending, 60000);
    return () => {
      mounted = false;
      window.removeEventListener('sms-count-changed', loadPending);
      window.clearInterval(interval);
    };
  }, [pathname]);

  // Use server-provided profile immediately; fall back to AuthProvider
  const profile = serverProfile || authProfile;
  const lastSignInAt = serverUser?.last_sign_in_at ?? authUser?.last_sign_in_at;
  const isDemo = profile?.email === 'demo@redix.media' || (typeof window !== 'undefined' && document.cookie.includes('demo-mode=true'));

  // Role-based route filtering
  const filteredItems = navItems.map((item) => {
    if (item.children) {
      const children = item.children.filter((child) => {
        if (!profile) return false;
        const role = profile.role;
        if (role === 'Super Admin') return true;

        if (child.href.startsWith('/pt')) {
          if (role === 'Admin') return true;
          if (role === 'Receptionist') {
            return child.href !== '/pt/reports';
          }
          if (role === 'Trainer') {
            return ['/pt', '/pt/members', '/pt/packages', '/pt/trainers', '/pt/schedule', '/pt/attendance'].includes(child.href);
          }
          return false;
        }

        if (child.href.startsWith('/devices')) {
          return role === 'Admin';
        }

        if (role === 'Admin' || role === 'Receptionist') {
          return ['/staff', '/staff/attendance'].includes(child.href);
        }
        if (role === 'Trainer') {
          return ['/staff'].includes(child.href);
        }
        return false;
      });
      return { ...item, children };
    }
    return item;
  }).filter((item) => {
    if (item.href === '/about') return true;
    if (!profile) return false;
    const role = profile.role;

    if (item.children) {
      return item.children.length > 0;
    }

    if (role === 'Super Admin') return true;
    if (role === 'Admin') {
      return ['/', '/members', '/attendance', '/monitor', '/devices', '/invoices', '/reports', '/sms', '/settings', '/backup'].includes(item.href);
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

  const [staffExpanded, setStaffExpanded] = useState(pathname.startsWith('/staff'));
  const [ptExpanded, setPtExpanded] = useState(pathname.startsWith('/pt'));
  const [devicesExpanded, setDevicesExpanded] = useState(pathname.startsWith('/devices'));

  useEffect(() => {
    if (pathname.startsWith('/staff')) {
      setStaffExpanded(true);
    }
    if (pathname.startsWith('/pt')) {
      setPtExpanded(true);
    }
    if (pathname.startsWith('/devices')) {
      setDevicesExpanded(true);
    }
  }, [pathname]);

  return (
    <>
      <div className={cn('relative flex h-20 items-center border-b border-white/[0.07]', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-300 shadow-[0_6px_20px_rgba(244,196,48,0.2)]">
          <Dumbbell className="h-5 w-5 text-zinc-950" strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>FusionFit</span>
              {isDemo && (
                <span className="inline-flex items-center rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 uppercase tracking-wider border border-amber-400/30">
                  Demo
                </span>
              )}
            </p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Gym management</p>
          </div>
        )}
        {collapsed && isDemo && (
          <div className="absolute top-4 right-4 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-[#0b0d12]" title="Demo Mode Active" />
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
          {finalItems.map((item) => {
            if (item.children) {
              const isChildActive = item.children.some(child => isRouteActive(pathname, child.href));
              const isPt = item.label === 'Personal Training';
              const isStaff = item.label === 'Staff';
              const isDevices = item.label === 'Device Management';
              const expanded = isPt ? ptExpanded : (isStaff ? staffExpanded : devicesExpanded);
              const toggleExpand = () => {
                if (isPt) setPtExpanded(!ptExpanded);
                else if (isStaff) setStaffExpanded(!staffExpanded);
                else if (isDevices) setDevicesExpanded(!devicesExpanded);
              };
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className={cn(
                      'group w-full flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors duration-150 justify-between px-3 cursor-pointer',
                      isChildActive
                        ? 'bg-amber-300 text-zinc-950 shadow-[0_8px_24px_rgba(244,196,48,0.18)]'
                        : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
                      collapsed && 'justify-center'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-zinc-500 transition-transform duration-200',
                          expanded && 'rotate-180'
                        )}
                      />
                    )}
                  </button>
                  {expanded && !collapsed && (
                    <ul className="pl-4 space-y-1 mt-1 border-l border-white/[0.07] ml-5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          label={child.label}
                          icon={child.icon}
                          active={pathname === child.href}
                          collapsed={collapsed}
                          onClick={onNavigate}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            }

            const isUserManagement = item.href === '/users';
            const handleLinkClick = (e: React.MouseEvent) => {
              if (isDemo && isUserManagement) {
                e.preventDefault();
                toast.error('This feature is unavailable in Demo Mode.');
                return;
              }
              if (onNavigate) {
                onNavigate();
              }
            };

            return (
              <NavLink
                key={item.href}
                {...item}
                active={isRouteActive(pathname, item.href)}
                collapsed={collapsed}
                onClick={handleLinkClick}
                badge={item.href === '/sms' ? pendingSmsCount : undefined}
              />
            );
          })}
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
  const isDemo = typeof window !== 'undefined' && document.cookie.includes('demo-mode=true');
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
            <p className="text-sm font-bold tracking-tight text-slate-950 flex items-center gap-1.5">
              <span>FusionFit</span>
              {isDemo && (
                <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-black text-amber-700 uppercase tracking-wide border border-amber-300/30">
                  Demo
                </span>
              )}
            </p>
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
