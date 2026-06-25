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
  
  console.log('--- Checking users_profiles ---');
  const { data: profiles, error: profilesError } = await supabase
    .from('users_profiles')
    .select('*');
    
  if (profilesError) {
    console.error('profiles Error:', profilesError);
  } else {
    console.log(`Profiles Count: ${profiles ? profiles.length : 0}`);
    console.log('Profiles:', profiles);
  }
}

run();
