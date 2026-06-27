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
  console.log('Verifying members columns...');
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .select('*')
    .limit(1);

  if (memberError) {
    console.error('Error querying members:', memberError);
  } else {
    const cols = memberData.length > 0 ? Object.keys(memberData[0]) : [];
    console.log('Members columns:', cols);
    console.log('trainer_package exists:', cols.includes('trainer_package'));
    console.log('trainer_fee exists:', cols.includes('trainer_fee'));
  }

  console.log('\nVerifying invoices columns...');
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .limit(1);

  if (invoiceError) {
    console.error('Error querying invoices:', invoiceError);
  } else {
    const cols = invoiceData.length > 0 ? Object.keys(invoiceData[0]) : [];
    console.log('Invoices columns:', cols);
    console.log('trainer_fee exists:', cols.includes('trainer_fee'));
  }
}

run();
