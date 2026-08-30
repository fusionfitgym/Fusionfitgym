const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function testDashboard() {
  const now = new Date();
  const yr = now.getFullYear();
  const mth = String(now.getMonth() + 1).padStart(2, '0');
  const dy = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yr}-${mth}-${dy}`;

  const addDaysLoc = (dateStr, days) => {
    const res = new Date(dateStr);
    res.setDate(res.getDate() + days);
    return res.toISOString().split('T')[0];
  };
  const threeDaysLaterStr = addDaysLoc(todayStr, 3);
  const sevenDaysLaterStr = addDaysLoc(todayStr, 7);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const sixMonthsAgoStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1).toISOString();

  const memberSelectCols = 'id, full_name, phone, package_name, package_start_date, package_end_date, status, profile_photo, duration, training_type, biometric_status, biometric_user_id';

  console.log('Running dashboard queries test...');
  try {
    const basePromises = [
      supabase.from('members').select('id', { count: 'exact', head: true }),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').eq('duration', 'Daily Pass'),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').neq('duration', 'Daily Pass'),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').eq('training_type', 'Weight Training Only'),
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').in('training_type', ['Weight Training + Cardio', 'Weight Training + Strength Training']),
      supabase.from('members').select(memberSelectCols).order('created_at', { ascending: false }).limit(5),
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').eq('package_end_date', todayStr),
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').gt('package_end_date', todayStr).lte('package_end_date', threeDaysLaterStr),
      supabase.from('members').select(memberSelectCols).eq('status', 'Expired').limit(50),
      supabase.from('members').select(memberSelectCols).eq('biometric_status', 'DISABLED').limit(50),
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').neq('duration', 'Daily Pass').gte('package_end_date', todayStr).lte('package_end_date', sevenDaysLaterStr).order('package_end_date', { ascending: true }).limit(5),
      supabase.from('members').select('package_name').eq('status', 'Active'),
      supabase
        .from('invoices')
        .select('id, invoice_number, amount, paid_amount, status, created_at, payment_date, payment_method, member_id, member:members(full_name, phone)')
        .eq('status', 'Paid')
        .gte('created_at', sixMonthsAgoStart)
        .order('created_at', { ascending: false }),
      supabase.from('invoices').select('paid_amount, amount').eq('status', 'Paid')
    ];

    const results = await Promise.all(basePromises);
    results.forEach((r, idx) => {
      console.log(`Query ${idx}: error=${r.error ? JSON.stringify(r.error) : 'null'}, dataCount=${r.data ? r.data.length : 'none'}, count=${r.count}`);
    });
  } catch (err) {
    console.error('Fatal error:', err);
  }
}

testDashboard();
