const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const idleProgress = {
    status: 'idle',
    step: 'idle',
    progress: 0,
    error: null,
    lastUpdated: new Date().toISOString()
  };

  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'backup_current_progress', value: JSON.stringify(idleProgress) }, { onConflict: 'key' });

  if (error) {
    console.error('Failed to reset backup progress:', error);
  } else {
    console.log('Backup progress successfully reset to IDLE.');
  }
}

run();
