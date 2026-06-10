'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Dumbbell,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/members/add', label: 'Add Member', icon: UserPlus },
  { href: '/health', label: 'Health Assessments', icon: HeartPulse },
  { href: '/parq', label: 'PAR-Q Forms', icon: ClipboardList },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
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
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
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
          {navItems.map((item) => (
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

      {!collapsed && (
        <div className="border-t border-white/[0.07] px-4 py-4">
          <p className="text-center text-[10px] font-medium text-zinc-600">FusionFit workspace</p>
        </div>
      )}
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          <NavContent pathname={pathname} />
        </div>
        <div className="flex h-full w-full flex-col lg:hidden">
          <NavContent pathname={pathname} collapsed />
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
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
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
            <NavContent pathname={pathname} onNavigate={closeMobile} onClose={closeMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
