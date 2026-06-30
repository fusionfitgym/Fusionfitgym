const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse env file
let supabaseUrl = '';
let supabaseKey = '';

try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
        supabaseUrl = val;
      } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
        supabaseKey = val;
      }
    }
  }
} catch (e) {
  console.error('Failed to parse .env.local', e);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log('Checking sms_logs table columns...');
  const { data, error } = await supabase
    .from('sms_logs')
    .select('id, last_resend_at, resend_count')
    .limit(1);

  if (error) {
    console.error('Error fetching SMS columns:', error.message);
    if (error.message.includes('column') || error.message.includes('does not exist')) {
      console.log('STATUS: COLUMNS_DO_NOT_EXIST');
    } else {
      console.log('STATUS: OTHER_ERROR');
    }
  } else {
    console.log('STATUS: COLUMNS_EXIST', data);
  }
}

checkColumns();
