import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  console.log(`[Middleware] Start invocation for: ${pathname}`);

  try {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);

    let supabaseResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Safety check for missing environment variables
    if (!url || !anonKey) {
      console.warn('[Middleware] Warning: Supabase environment variables are missing.');
      return supabaseResponse;
    }

    // 2. Safety check for valid URL format to prevent createServerClient from throwing
    try {
      new URL(url);
    } catch (err) {
      console.error('[Middleware] Error: Invalid NEXT_PUBLIC_SUPABASE_URL:', url, err);
      return supabaseResponse;
    }

    console.log('[Middleware] Initializing createServerClient...');
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          console.log('[Middleware] setAll cookies trigger:', cookiesToSet.map(c => c.name));
          const rememberMe = request.cookies.get('remember_me')?.value !== 'false';
          
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // Clone the request.headers AFTER cookies are updated on the request object to preserve them
          const currentHeaders = new Headers(request.headers);
          currentHeaders.set('x-pathname', pathname);
          
          supabaseResponse = NextResponse.next({
            request: {
              headers: currentHeaders,
            },
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
    });
    console.log('[Middleware] createServerClient initialized successfully.');

    // 3. Retrieve authenticated user state
    console.log('[Middleware] Fetching authenticated user (getUser)...');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn('[Middleware] getUser returned auth error:', error.message);
    } else {
      console.log('[Middleware] getUser completed. User authenticated:', !!user);
    }

    // Define public paths that do not require authentication
    const isAuthPage = pathname.startsWith('/login') || 
                       pathname.startsWith('/forgot-password') || 
                       pathname.startsWith('/reset-password') ||
                       pathname.startsWith('/auth/callback');

    // 4. Perform redirects
    if (!user) {
      if (!isAuthPage) {
        console.log(`[Middleware] Unauthenticated access to protected page ${pathname}. Redirecting to /login`);
        const urlObj = request.nextUrl.clone();
        urlObj.pathname = '/login';
        return NextResponse.redirect(urlObj);
      }
      return supabaseResponse;
    }

    // Redirect authenticated users away from login/forgot/reset pages
    if (isAuthPage && !pathname.startsWith('/auth/callback')) {
      console.log(`[Middleware] Authenticated user on auth page ${pathname}. Redirecting to dashboard root (/)`);
      const urlObj = request.nextUrl.clone();
      urlObj.pathname = '/';
      return NextResponse.redirect(urlObj);
    }

    return supabaseResponse;
  } catch (error) {
    // 5. Catch-all defensive error handling to prevent 500 MIDDLEWARE_INVOCATION_FAILED
    console.error('[Middleware] Runtime execution exception caught:', error);
    
    // In case of error, still try to forward the custom header safely
    try {
      const fallbackHeaders = new Headers(request.headers);
      fallbackHeaders.set('x-pathname', pathname);
      return NextResponse.next({
        request: {
          headers: fallbackHeaders,
        },
      });
    } catch {
      return NextResponse.next();
    }
  }
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
