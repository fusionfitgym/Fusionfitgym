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
  
  console.log('--- 1. Testing members query ---');
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, phone, package_name, package_start_date, package_end_date, status, profile_photo');
    
  if (membersError) {
    console.error('Members Error:', membersError);
  } else {
    console.log(`Members Count: ${members ? members.length : 0}`);
    if (members && members.length > 0) {
      console.log('Sample Member:', members[0]);
    }
  }

  console.log('\n--- 2. Testing invoices query ---');
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('amount, status, created_at')
    .eq('status', 'Paid');

  if (invoicesError) {
    console.error('Invoices Error:', invoicesError);
  } else {
    console.log(`Paid Invoices Count: ${invoices ? invoices.length : 0}`);
    if (invoices && invoices.length > 0) {
      console.log('Sample Paid Invoice:', invoices[0]);
    }
  }

  console.log('\n--- 3. Testing attendance logs query ---');
  const { data: attLogs, error: attLogsError } = await supabase
    .from('attendance_logs')
    .select('*')
    .limit(5);

  if (attLogsError) {
    console.error('Attendance Logs Error:', attLogsError);
  } else {
    console.log(`Attendance Logs Count: ${attLogs ? attLogs.length : 0}`);
  }
}

run();
