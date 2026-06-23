import { createBrowserClient } from '@supabase/ssr'

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

export function createClient(): ReturnType<typeof createBrowserClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn("Supabase browser environment variables are missing! Returning safe stub client.");
    return createSafeStub(new Error("Missing client-side Supabase environment variables.")) as any;
  }

  try {
    new URL(url);
  } catch (urlErr) {
    console.error("Invalid NEXT_PUBLIC_SUPABASE_URL format for browser client! Returning safe stub client.", urlErr);
    return createSafeStub(new Error("Invalid client-side NEXT_PUBLIC_SUPABASE_URL: " + url)) as any;
  }

  return createBrowserClient(url, anonKey)
}


