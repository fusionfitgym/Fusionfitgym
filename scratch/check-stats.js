const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // We check if it is modern schema
  const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
  const isModern = !error;

  const renewalFilter = isModern
    ? 'message_type.eq.Renewal,message_type.ilike.Expiry Warning%'
    : 'sms_type.eq.Renewal,sms_type.ilike.Expiry Warning%';

  const [
    { count: todaySent },
    { count: monthlySent },
    { count: failedCount },
    { count: pendingCount },
    { count: renewalRemindersSent },
    { count: notificationQueue },
    { count: totalSent },
  ] = await Promise.all([
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .gte('created_at', todayStart.toISOString()),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Failed'),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Pending'),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent')
      .or(renewalFilter),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['Pending', 'Failed']),
    supabase
      .from('sms_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Sent'),
  ]);

  console.log('Stats:');
  console.log('todayStart:', todayStart.toISOString());
  console.log('monthStart:', monthStart.toISOString());
  console.log('todaySent count:', todaySent);
  console.log('monthlySent count:', monthlySent);
  console.log('failedCount:', failedCount);
  console.log('pendingCount:', pendingCount);
  console.log('renewalRemindersSent:', renewalRemindersSent);
  console.log('notificationQueue:', notificationQueue);
  console.log('totalSent:', totalSent);
}

run();
