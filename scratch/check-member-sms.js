const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const memberId = '3732d685-989b-4052-adbc-63ef34cd8160'; // shambhu
  console.log('--- Testing lookup for member:', memberId);

  const { data: member } = await supabase.from('members').select('full_name, phone').eq('id', memberId).maybeSingle();
  console.log('Member details:', member);

  const phone = member?.phone || '';
  const cleanDigits = phone ? phone.replace(/\D/g, '').slice(-10) : '';

  let query = supabase.from('sms_logs').select('*');
  if (cleanDigits) {
    query = query.or(`member_id.eq.${memberId},phone_number.ilike.%${cleanDigits}%,phone.ilike.%${cleanDigits}%`);
  } else {
    query = query.eq('member_id', memberId);
  }

  const { data: logs, error } = await query.order('created_at', { ascending: false });
  console.log(`Found ${logs?.length || 0} logs for member ${member?.full_name}:`);
  logs?.forEach(l => {
    console.log(`  - status: ${l.status}, date: ${l.created_at}, msg: "${l.message.substring(0, 30)}..."`);
  });
}

run();
