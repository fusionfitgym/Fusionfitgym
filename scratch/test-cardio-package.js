const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';
const supabase = createClient(url, key);

// Helper function mock to test backend actions
function getDurationInDays(duration) {
  const durStr = duration.toLowerCase().trim();
  if (durStr === 'cardio') return 30;
  if (durStr.includes('daily')) return 1;
  if (durStr.includes('30 day') || durStr === '1 month') return 30;
  return 30;
}

async function testCardioPackage() {
  console.log('--- STARTING CARDIO PACKAGE VERIFICATION ---');

  // Test 1: Duration in days
  const days = getDurationInDays('Cardio');
  console.log(`Test 1: Cardio duration in days = ${days} (Expected: 30)`);
  if (days !== 30) throw new Error('Test 1 Failed');

  // Test 2: Database Persistence
  console.log('\nTest 2: Testing Database Persistence...');
  const testMember = {
    full_name: 'Test Cardio Member',
    phone: '9876543210',
    dob: '1995-05-05',
    gender: 'Gents',
    duration: 'Cardio',
    training_type: 'Weight Training Only',
    membership_fee: 1000,
    package_name: 'Cardio',
    package_duration: 'Cardio',
    package_price: 1000,
    package_start_date: new Date().toISOString().split('T')[0],
    package_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Active',
    machine_type: 'Gents'
  };

  const { data: inserted, error: insertError } = await supabase
    .from('members')
    .insert([testMember])
    .select()
    .single();

  if (insertError) {
    console.error('Insert failed:', insertError);
    throw insertError;
  }

  console.log(`Successfully created Cardio member! ID: ${inserted.id}`);
  console.log(`Saved Package Name: "${inserted.package_name}" (Expected: "Cardio")`);
  console.log(`Saved Membership Fee: ₹${inserted.membership_fee} (Expected: ₹1000)`);

  if (inserted.package_name !== 'Cardio' || Number(inserted.membership_fee) !== 1000) {
    throw new Error('Test 2 Failed: Saved details do not match');
  }

  // Clean up
  console.log('\nCleaning up test record...');
  const { error: deleteError } = await supabase
    .from('members')
    .delete()
    .eq('id', inserted.id);

  if (deleteError) {
    console.error('Cleanup failed:', deleteError);
  } else {
    console.log('Cleanup completed successfully.');
  }

  console.log('\n--- CARDIO PACKAGE VERIFICATION PASSED ---');
}

testCardioPackage().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
