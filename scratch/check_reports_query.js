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
  
  console.log('--- Running getAttendanceReport query ---');
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7); // weekly filter
  
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, member_name, biometric_user_id, punch_time, punch_type')
    .gte('punch_time', startDate.toISOString())
    .order('punch_time', { ascending: false });

  if (error) {
    console.error('Query Failed with Error:', error);
  } else {
    console.log(`Success! Count: ${data ? data.length : 0}`);
  }
}

run();
