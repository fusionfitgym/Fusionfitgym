import Sidebar from '@/components/layout/Sidebar';
import { getCurrentUserProfile } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 1. Retrieve the profile of the authenticated user
  const result = await getCurrentUserProfile();
  if (!result || !result.profile) {
    redirect('/login');
  }

  const { profile, user } = result;

  // 2. Protect against suspended status
  if (profile.status === 'Suspended') {
    redirect('/login?error=Your account has been suspended. Please contact the administrator.');
  }

  // 3. Perform Role-Based Access Control (RBAC)
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '/';

  const role = profile.role;

  // Prepare server profile data for Sidebar (avoids duplicate AuthProvider fetch)
  const serverProfile = {
    id: profile.id,
    auth_user_id: profile.auth_user_id,
    full_name: profile.full_name,
    email: profile.email,
    role: profile.role as 'Super Admin' | 'Admin' | 'Receptionist' | 'Trainer',
    status: profile.status as 'Active' | 'Suspended',
    created_at: profile.created_at || '',
  };

  const serverUser = user ? {
    last_sign_in_at: user.last_sign_in_at,
  } : undefined;

  // Super Admin has full system permissions
  if (role === 'Super Admin') {
    return (
      <div className="app-shell">
        <Sidebar serverProfile={serverProfile} serverUser={serverUser} />
        <main className="app-main">
          <div className="app-content">{children}</div>
        </main>
      </div>
    );
  }

  let isAllowed = false;

  if (role === 'Admin') {
    const allowedPrefixes = ['/', '/members', '/attendance', '/monitor', '/devices', '/invoices', '/reports', '/sms', '/settings', '/about'];
    isAllowed = allowedPrefixes.some((prefix) => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
  } else if (role === 'Receptionist') {
    const allowedPrefixes = ['/', '/members', '/attendance', '/monitor', '/invoices', '/about'];
    isAllowed = allowedPrefixes.some((prefix) => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
  } else if (role === 'Trainer') {
    const allowedPrefixes = ['/', '/members', '/health', '/parq', '/about'];
    isAllowed = allowedPrefixes.some((prefix) => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
  }

  // /users is strictly for Super Admin
  if (pathname.startsWith('/users')) {
    isAllowed = false;
  }

  if (!isAllowed) {
    redirect('/unauthorized');
  }

  return (
    <div className="app-shell">
      <Sidebar serverProfile={serverProfile} serverUser={serverUser} />
      <main className="app-main">
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
