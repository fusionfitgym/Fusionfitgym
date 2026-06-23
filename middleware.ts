import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Safety guard for missing environment variables
  if (!url || !anonKey) {
    console.warn('Supabase environment variables are missing in middleware.');
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const rememberMe = request.cookies.get('remember_me')?.value !== 'false';
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          
          // Ensure we clone current headers containing updated cookies
          const currentHeaders = new Headers(request.headers);
          currentHeaders.set('x-pathname', request.nextUrl.pathname);
          
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

    // Retrieve user session state with a fallback
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
        const urlObj = request.nextUrl.clone();
        urlObj.pathname = '/login';
        return NextResponse.redirect(urlObj);
      }
      return supabaseResponse;
    }

    // If authenticated:
    // Redirect login/auth pages back to Dashboard /
    if (isAuthPage && !pathname.startsWith('/auth/callback')) {
      const urlObj = request.nextUrl.clone();
      urlObj.pathname = '/';
      return NextResponse.redirect(urlObj);
    }
  } catch (error) {
    // Prevent unhandled errors from causing MIDDLEWARE_INVOCATION_FAILED (500)
    console.error('Middleware execution error caught:', error);
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
