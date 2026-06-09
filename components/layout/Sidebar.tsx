'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  HeartPulse,
  ClipboardList,
  FileText,
  Settings,
  Dumbbell,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/',           label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/members',    label: 'Members',           icon: Users },
  { href: '/members/add',label: 'Add Member',        icon: UserPlus },
  { href: '/health',     label: 'Health Assessments',icon: HeartPulse },
  { href: '/parq',       label: 'PAR-Q Forms',       icon: ClipboardList },
  { href: '/invoices',   label: 'Invoices',          icon: FileText },
  { href: '/settings',   label: 'Settings',          icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'var(--gym-yellow)' }}>
            <Dumbbell className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">FusionFit</div>
            <div className="text-xs text-gray-500 font-medium">GYM MANAGEMENT</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3 px-2">Menu</p>
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-black font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  style={isActive ? { background: 'var(--gym-yellow)', color: '#000' } : {}}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#1f1f1f]">
        <div className="text-xs text-gray-600 text-center">
          © 2025 FusionFit Gym
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen fixed top-0 left-0 z-40"
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--gym-black-2)',
          borderRight: '1px solid #1f1f1f',
        }}
      >
        <NavContent />
      </aside>

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 rounded-xl flex items-center justify-center text-white"
        style={{ background: 'var(--gym-black-2)', border: '1px solid #333' }}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="relative flex flex-col h-full z-50"
            style={{
              width: 'var(--sidebar-width)',
              background: 'var(--gym-black-2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <NavContent />
          </aside>
        </div>
      )}
    </>
  );
}
