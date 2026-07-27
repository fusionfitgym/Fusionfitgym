const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: logs } = await supabase.from('sms_logs').select('id, member_id, member_name, phone_number, phone, status').limit(20);
  console.log('Sample SMS Logs:');
  logs.forEach(l => {
    console.log(`- logId: ${l.id}, member_id: ${l.member_id}, name: ${l.member_name}, phone: ${l.phone_number || l.phone}`);
  });

  const { data: members } = await supabase.from('members').select('id, full_name, phone').limit(5);
  console.log('\nSample Members:');
  members.forEach(m => {
    console.log(`- memberId: ${m.id}, name: ${m.full_name}, phone: ${m.phone}`);
  });
}

run();
