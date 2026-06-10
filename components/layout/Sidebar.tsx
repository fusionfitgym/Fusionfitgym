'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, UserPlus, HeartPulse,
  ClipboardList, FileText, Settings, Dumbbell, Menu, X,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const navItems = [
  { href: '/',           label: 'Dashboard',          icon: LayoutDashboard },
  { href: '/members',    label: 'Members',            icon: Users },
  { href: '/members/add',label: 'Add Member',         icon: UserPlus },
  { href: '/health',     label: 'Health Assessments', icon: HeartPulse },
  { href: '/parq',       label: 'PAR-Q Forms',        icon: ClipboardList },
  { href: '/invoices',   label: 'Invoices',           icon: FileText },
  { href: '/settings',   label: 'Settings',           icon: Settings },
];

function NavLink({ href, label, icon: Icon, isActive, isCollapsed, onClick }: {
  href: string; label: string; icon: React.ElementType; isActive: boolean; isCollapsed?: boolean; onClick?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        title={isCollapsed ? label : undefined}
        className={`relative flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'} rounded-lg text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? 'bg-[#FFD700] text-black font-semibold shadow-[0_0_12px_rgba(255,215,0,0.25)]'
            : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
        }`}
      >
        {isActive && !isCollapsed && (
          <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r bg-yellow-600" />
        )}
        <Icon className={`${isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} flex-shrink-0`} />
        {!isCollapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}

const NavContent = ({ pathname, isCollapsed, onNavigate }: { pathname: string; isCollapsed?: boolean; onNavigate?: () => void }) => (
  <>
    {/* Logo */}
    <div className={`py-5 border-b border-zinc-800/80 flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4 gap-2.5'}`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#FFD700] flex-shrink-0">
        <Dumbbell className="w-4 h-4 text-black" />
      </div>
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <div className="font-bold text-white text-[13px] leading-tight truncate">FusionFit</div>
          <div className="text-[9px] text-zinc-600 font-semibold uppercase tracking-[0.15em] truncate">Gym Management</div>
        </div>
      )}
    </div>

    {/* Nav */}
    <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto overflow-x-hidden">
      {!isCollapsed && (
        <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-[0.15em] mb-2 px-3">Menu</p>
      )}
      <ul className="space-y-1">
        {navItems.map(({ href, label, icon }) => {
          const isActive =
            href === '/' ? pathname === '/' :
            href === '/members/add' ? pathname === '/members/add' :
            pathname === href || pathname.startsWith(href + '/');
          return (
            <NavLink key={href} href={href} label={label} icon={icon} isActive={isActive} isCollapsed={isCollapsed} onClick={onNavigate} />
          );
        })}
      </ul>
    </nav>

    {/* Footer */}
    {!isCollapsed && (
      <div className="px-4 py-3 border-t border-zinc-800/80">
        <p className="text-[9px] text-zinc-700 text-center font-medium truncate">© 2025 FusionFit</p>
      </div>
    )}
  </>
);

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Close on Escape
  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setMobileOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [handleEsc]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop/Tablet Sidebar (Grid Item) */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 bg-[#09090B] border-r border-zinc-800/80 z-40 overflow-hidden">
        <div className="hidden lg:flex flex-col h-full w-full">
          <NavContent pathname={pathname} />
        </div>
        <div className="flex lg:hidden flex-col h-full w-full">
          <NavContent pathname={pathname} isCollapsed={true} />
        </div>
      </aside>

      {/* Mobile Toggle Button */}
      <div className="md:hidden fixed top-0 left-0 w-full h-16 bg-white/80 backdrop-blur-lg border-b border-slate-200 z-40 flex items-center px-4">
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white bg-[#09090B] active:scale-95 transition-transform"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="ml-3 font-bold text-slate-900 text-[15px]">FusionFit</div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="relative flex flex-col h-full z-50 w-[260px] bg-[#09090B] shadow-2xl animate-[slideIn_0.2s_ease]"
            onClick={e => e.stopPropagation()}
          >
            <NavContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
