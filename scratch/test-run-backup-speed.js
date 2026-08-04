const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('Testing speed of parallel table export...');
  const start = Date.now();
  
  const { data: dbTables } = await supabase.rpc('get_public_tables');
  const tables = dbTables ? dbTables.map(row => typeof row === 'string' ? row : row.table_name) : [];
  
  console.log(`Discovered ${tables.length} tables.`);

  const databaseData = {};
  let totalRecords = 0;
  const BATCH_SIZE = 6;
  
  for (let i = 0; i < tables.length; i += BATCH_SIZE) {
    const batch = tables.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (table) => {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return { table, data: data || [] };
      })
    );

    for (const res of results) {
      databaseData[res.table] = res.data;
      totalRecords += res.data.length;
    }
  }

  const duration = Date.now() - start;
  console.log(`Exported ${tables.length} tables (${totalRecords} records total) in ${duration}ms!`);
}

run();
