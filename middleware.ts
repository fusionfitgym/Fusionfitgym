import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const rememberMe = request.cookies.get('remember_me')?.value !== 'false';
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opt = { ...options };
            if (!rememberMe) {
              delete opt.maxAge;
              delete opt.expires;
            }
            supabaseResponse.cookies.set(name, value, opt);
          });
        },
      },
    }
  );

  // Retrieve user session state
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Define public paths that do not require authentication
  const isAuthPage = pathname.startsWith('/login') || 
                     pathname.startsWith('/forgot-password') || 
                     pathname.startsWith('/reset-password') ||
                     pathname.startsWith('/auth/callback');

  // If unauthenticated: redirect protected pages to /login
  if (!user) {
    if (!isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // If authenticated:
  
  // 1. Redirect login pages back to Dashboard /
  if (isAuthPage && !pathname.startsWith('/auth/callback')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 2. Fetch User Profile for Role Validation and Disabled Status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, disabled')
    .eq('auth_user_id', user.id)
    .single();

  // If user profile is not found or is disabled: log them out and redirect to login page
  if (!profile || profile.disabled) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'Your account has been disabled or does not exist.');
    const response = NextResponse.redirect(url);
    // Clear cookies
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');
    return response;
  }

  const role = profile.role;

  // 3. Route Protection (Role-Based Access Control)
  
  // Super Admin: Full Access to all routes
  if (role === 'Super Admin') {
    return supabaseResponse;
  }

  // settings/users is only accessible by Super Admin
  if (pathname.startsWith('/settings/users')) {
    const url = request.nextUrl.clone();
    url.pathname = '/unauthorized';
    return NextResponse.redirect(url);
  }

  // Admin access validation
  if (role === 'Admin') {
    const allowedPrefixes = ['/', '/members', '/attendance', '/monitor', '/invoices', '/reports', '/sms', '/settings'];
    const isAllowed = allowedPrefixes.some(prefix => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Receptionist access validation
  if (role === 'Receptionist') {
    const allowedPrefixes = ['/', '/members', '/attendance', '/monitor', '/invoices'];
    const isAllowed = allowedPrefixes.some(prefix => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Trainer access validation
  if (role === 'Trainer') {
    const allowedPrefixes = ['/', '/members', '/health', '/parq'];
    const isAllowed = allowedPrefixes.some(prefix => {
      if (prefix === '/') return pathname === '/';
      return pathname.startsWith(prefix);
    });
    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/unauthorized';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - *.svg, *.png, *.jpg, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
