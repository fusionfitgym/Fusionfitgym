const { createClient } = require('@supabase/supabase-js');

const url = 'https://jfriacldwyfntttnbvwi.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcmlhY2xkd3lmbnR0dG5idndpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAxNjA1NSwiZXhwIjoyMDk2NTkyMDU1fQ.tmrf7hQBJ19fPoN0t8UJgt8UofcISQKJUbSprbvARSQ';

const supabase = createClient(url, serviceKey);

async function run() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  const maxSeq = Math.max(...invoices.map(inv => {
    const match = inv.invoice_number.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  }));

  console.log(`Max sequence in DB: ${maxSeq}`);
  
  const { error: rpcError } = await supabase.rpc('set_invoice_sequence', { start_num: maxSeq + 1 });
  
  if (rpcError) {
    console.error('Error resetting sequence:', rpcError);
  } else {
    console.log(`Successfully reset invoice sequence to ${maxSeq + 1}`);
  }
}

run();
