const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: member } = await supabase.from('members').select('*').limit(1).maybeSingle();
  const { data: staff } = await supabase.from('staff').select('*').limit(1).maybeSingle();
  const { data: attendance_log } = await supabase.from('attendance_logs').select('*').limit(1).maybeSingle();
  const { data: staff_attendance } = await supabase.from('staff_attendance').select('*').limit(1).maybeSingle();
  const { data: biometric_action } = await supabase.from('biometric_actions').select('*').limit(1).maybeSingle();

  console.log('members columns:', Object.keys(member || {}));
  console.log('staff columns:', Object.keys(staff || {}));
  console.log('attendance_logs columns:', Object.keys(attendance_log || {}));
  console.log('staff_attendance columns:', Object.keys(staff_attendance || {}));
  console.log('biometric_actions columns:', Object.keys(biometric_action || {}));
}
run();
