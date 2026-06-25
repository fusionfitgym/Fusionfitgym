const fs = require('fs');
const path = require('path');

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
  // Use anon key, just like the web client
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  console.log('Signing in as superadmin@fusionfit.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'superadmin@fusionfit.com',
    password: 'password123'
  });
  
  if (authError) {
    console.error('Sign in failed:', authError);
    return;
  }
  
  console.log('Sign in successful. User ID:', authData.user.id);
  
  console.log('\n--- 1. Querying users_profiles as authenticated user ---');
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('*');
  
  if (profileError) {
    console.error('Profile Error:', profileError);
  } else {
    console.log('Profile results count:', profile.length);
    console.log('Profiles:', profile);
  }

  console.log('\n--- 2. Querying members as authenticated user ---');
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, status');
    
  if (membersError) {
    console.error('Members Error:', membersError);
  } else {
    console.log('Members count:', members.length);
    console.log('Members:', members);
  }

  console.log('\n--- 3. Querying invoices as authenticated user ---');
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('amount, status');

  if (invoicesError) {
    console.error('Invoices Error:', invoicesError);
  } else {
    console.log('Invoices count:', invoices.length);
    console.log('Invoices:', invoices);
  }

  console.log('\n--- 4. Querying attendance_logs as authenticated user ---');
  const { data: logs, error: logsError } = await supabase
    .from('attendance_logs')
    .select('*');

  if (logsError) {
    console.error('Logs Error:', logsError);
  } else {
    console.log('Logs count:', logs.length);
  }
}

run();
