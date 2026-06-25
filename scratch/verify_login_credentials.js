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

async function testLogin(email, password) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log(`Testing login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Login failed for ${email}:`, error.message);
  } else {
    console.log(`Login SUCCESS for ${email}! User ID: ${data.user.id}`);
  }
}

async function run() {
  await testLogin('superadmin@fusionfit.com', 'password123');
  await testLogin('admin@fusionfit.com', 'password123');
  await testLogin('fusionfit747@gmail.com', 'password123');
  await testLogin('ihsan.anas8281@gmail.com', 'password123');
}

run();
