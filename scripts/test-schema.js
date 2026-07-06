const { createClient } = require('@supabase/supabase-js');
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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  try {
    console.log('Fetching a member...');
    const { data: member, error: fetchErr } = await supabase.from('members').select('id').limit(1).maybeSingle();
    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return;
    }
    if (!member) {
      console.log('No members found.');
      return;
    }
    console.log('Found member:', member.id);
    
    console.log('Testing inserting with staff_id column...');
    const { data, error } = await supabase
      .from('biometric_actions')
      .insert({
        member_id: member.id,
        staff_id: member.id, // Try sending staff_id
        biometric_id: '99999',
        action: 'enable',
        status: 'pending'
      });
    
    if (error) {
      console.log('Error output:', error.message, error.code);
    } else {
      console.log('Success output:', data);
    }
  } catch (err) {
    console.error('Unhandled script error:', err);
  }
}

checkSchema();
