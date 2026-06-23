import { createBrowserClient } from '@supabase/ssr'

export function createClient(): ReturnType<typeof createBrowserClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // During Next.js build / static site generation (where window is undefined),
    // return a stub client to prevent compilation crashes.
    if (typeof window === 'undefined') {
      return {
        auth: {
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      } as any
    }
    throw new Error("@supabase/ssr: Your project's URL and API key are required to create a Supabase client!")
  }

  return createBrowserClient(url, anonKey)
}

