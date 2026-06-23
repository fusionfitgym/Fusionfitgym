import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function createSafeStub(error: Error) {
  const stub: any = new Proxy(
    Object.assign(
      (async () => ({ data: null, error })) as any,
      {
        then(onfulfilled: any) {
          return Promise.resolve({ data: null, error }).then(onfulfilled);
        },
        catch(onrejected: any) {
          return Promise.resolve({ data: null, error }).catch(onrejected);
        },
      }
    ),
    {
      get(target, prop) {
        if (prop === 'then' || prop === 'catch') {
          return target[prop];
        }
        if (prop === 'auth') {
          return {
            getUser: async () => ({ data: { user: null }, error }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: async () => ({ error: null }),
            resetPasswordForEmail: async () => ({ error }),
            updateUser: async () => ({ data: { user: null }, error }),
            signInWithPassword: async () => ({ data: { user: null, session: null }, error }),
          };
        }
        return () => stub;
      },
    }
  );
  return stub;
}

export async function createClient(): Promise<ReturnType<typeof createServerClient>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn("Supabase environment variables are missing! Returning safe stub client.");
    return createSafeStub(new Error("Missing Supabase environment variables.")) as any;
  }

  try {
    new URL(url);
  } catch (urlErr) {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL format! Returning safe stub client.", urlErr);
    return createSafeStub(new Error("Invalid NEXT_PUBLIC_SUPABASE_URL: " + url)) as any;
  }


  const cookieStore = await cookies()

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const rememberMe = cookieStore.get('remember_me')?.value !== 'false';
            cookiesToSet.forEach(({ name, value, options }) => {
              const opt = { ...options };
              if (!rememberMe) {
                delete opt.maxAge;
                delete opt.expires;
              }
              cookieStore.set(name, value, opt);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

