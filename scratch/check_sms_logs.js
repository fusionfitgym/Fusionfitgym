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
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('--- 1. Querying sms_logs schema ---');
  const { data: logs, error } = await supabase
    .from('sms_logs')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log('Sample SMS Log row structure:', logs[0] || 'No rows found');
  }

  console.log('\n--- 2. Querying sms_devices ---');
  const { data: devices, error: devError } = await supabase
    .from('sms_devices')
    .select('*');
    
  if (devError) {
    console.log('sms_devices table does not exist or failed:', devError.message);
  } else {
    console.log('sms_devices:', devices);
  }
}

run();
