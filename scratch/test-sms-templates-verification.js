const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  console.log('--- TESTING SMS TEMPLATE DB ENTRIES ---');
  const { data: settings, error } = await supabase.from('settings').select('*');
  if (error) {
    console.error('Error querying settings:', error);
    return;
  }

  const templateSettings = settings.filter(s => s.key.includes('sms_template'));
  console.log('Current SMS Template Settings in DB:');
  templateSettings.forEach(s => console.log(`  [${s.key}]: ${JSON.stringify(s.value)}`));
}

run();
