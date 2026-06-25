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
  
  console.log('--- 1. Fetching all attendance logs ---');
  const { data: logs, error } = await supabase
    .from('attendance_logs')
    .select('*');
    
  if (error) {
    console.error('Error fetching logs:', error);
  } else {
    console.log(`Total Logs in DB: ${logs.length}`);
    if (logs.length > 0) {
      console.log('Logs structure & values (up to 5):');
      console.log(logs.slice(0, 5));
    }
  }
}

run();
