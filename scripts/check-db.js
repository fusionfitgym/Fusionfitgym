const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Querying database schema...');
  
  // Query all tables in the public schema
  const { data: tables, error: tablesError } = await supabase.rpc('get_tables_info');
  if (tablesError) {
    // If rpc doesn't exist, we can query via SQL executing endpoint if possible,
    // or try standard query or fetch tables list using postgrest schema request.
    console.log('RPC get_tables_info failed, attempting direct HTTP request to PostgREST OpenAPI/schema docs...');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Accept': 'application/openapi+json'
        }
      });
      const schema = await response.json();
      const rpcPaths = Object.keys(schema.paths).filter(p => p.startsWith('/rpc/'));
      console.log('RPC functions found:', rpcPaths);
    } catch (e) {
      console.error('Failed to get schema:', e);
    }
  } else {
    console.log('Tables:', tables);
  }
}

run();
