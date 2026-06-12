import { createClient } from '@/lib/supabase/server';

export default async function TestSupabasePage() {
  const supabase = await createClient();
  
  let isConnected = false;
  let authStatus = 'Checking...';
  let dbResult = '';

  try {
    // 1. Check Auth Status
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      // If error is because no session, it might say "Auth session missing!"
      authStatus = `Not authenticated (${authError.message})`;
    } else {
      authStatus = authData.user ? `Authenticated as ${authData.user.email}` : 'No active session (Anon)';
    }

    // 2. Database Query
    const { data: dbData, error: dbError } = await supabase.from('settings').select('*').limit(1);
    if (dbError) {
      dbResult = `Error: ${dbError.message}`;
    } else {
      isConnected = true;
      dbResult = `Success! Fetched ${dbData?.length} row(s) from 'settings'.`;
    }
  } catch (error: any) {
    dbResult = `Exception: ${error.message}`;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'Missing URL';

  return (
    <div className="min-h-screen p-8 bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center font-sans">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-zinc-100 dark:border-zinc-800">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Supabase Connection Test</h1>
          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${isConnected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isConnected ? '✅ Connected' : '❌ Connection Failed'}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Supabase URL</h2>
            <p className="mt-1 font-mono text-sm break-all text-zinc-800 dark:text-zinc-200">{supabaseUrl}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Authentication Status</h2>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{authStatus}</p>
          </div>

          <div>
            <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Database Query Result</h2>
            <div className="mt-1 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <code className="text-sm font-mono text-zinc-800 dark:text-zinc-200">{dbResult}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
