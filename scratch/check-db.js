const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // Query columns of invoices table
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error querying invoices:', error);
  } else {
    console.log('Query result keys (columns):', data.length > 0 ? Object.keys(data[0]) : 'No records found');
  }

  // Also query a count of null links if column exists
  if (data.length > 0 && 'invoice_link' in data[0]) {
    const { count, error: countErr } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('invoice_link', null);
    console.log('Invoices with NULL invoice_link:', countErr ? countErr : count);
  }
}

run();
