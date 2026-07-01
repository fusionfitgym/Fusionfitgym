const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, key);

async function checkColumns() {
  console.log('Querying invoices table to check columns...');
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully fetched invoice record!');
    console.log('Columns available in invoices table:', Object.keys(data[0] || {}));
  }
}

checkColumns();
