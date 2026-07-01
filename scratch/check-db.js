const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: logs, error: logsError } = await supabase
    .from('sms_logs')
    .select('id, status, created_at, message');
  
  if (logsError) {
    console.error('Error fetching logs:', logsError);
    return;
  }

  console.log('Logs:');
  logs.forEach(log => {
    console.log(`- ID: ${log.id}, Status: ${log.status}, CreatedAt: ${log.created_at}, msg: ${log.message.substring(0, 30)}`);
  });
}

run();
