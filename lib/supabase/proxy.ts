import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
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
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return supabaseResponse
}
