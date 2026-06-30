const { createClient } = require('@supabase/supabase-js');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 1. Read env variables
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

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const DEFAULT_TABLES = [
  'settings',
  'members',
  'users_profiles',
  'invoices',
  'attendance_logs',
  'sms_logs'
];

function encryptBuffer(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

function decryptBuffer(buffer, keyString) {
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = buffer.subarray(0, IV_LENGTH);
  const encryptedData = buffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

async function run() {
  console.log('--- STARTING BACKUP CORE INTEGRATION TEST ---');
  try {
    // 1. Discover tables dynamically
    console.log('1. Discovering tables...');
    let tables = DEFAULT_TABLES;
    const { data: dbTables, error: rpcError } = await adminSupabase.rpc('get_public_tables');
    if (!rpcError && dbTables) {
      tables = dbTables.map(row => typeof row === 'string' ? row : row.table_name);
      console.log('Successfully discovered tables via RPC:', tables);
    } else {
      console.log('RPC get_public_tables failed or not found. Falling back to default list.', rpcError?.message || '');
    }

    // 2. Fetch rows for each table
    console.log('2. Exporting database rows...');
    const databaseData = {};
    let totalRecords = 0;
    for (const table of tables) {
      const { data, error } = await adminSupabase.from(table).select('*');
      if (error) {
        console.error(`Warning: Failed to fetch table ${table}: ${error.message}`);
        continue;
      }
      databaseData[table] = data || [];
      totalRecords += (data?.length || 0);
      console.log(` - Table ${table}: ${data?.length || 0} records exported.`);
    }

    // 3. Compress ZIP
    console.log('3. Archiving ZIP package...');
    const zip = new AdmZip();
    zip.addFile('database.json', Buffer.from(JSON.stringify(databaseData, null, 2), 'utf8'));

    const metadata = {
      backup_date: new Date().toISOString(),
      erp_version: '0.1.0',
      total_records: totalRecords,
      file_size: 0
    };
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

    const zipBuffer = zip.toBuffer();
    metadata.file_size = zipBuffer.length;
    zip.deleteFile('metadata.json');
    zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));
    const finalZipBuffer = zip.toBuffer();

    console.log(` - ZIP package compressed: ${formatBytes(finalZipBuffer.length)}`);

    // 4. Encrypt ZIP
    console.log('4. Encrypting ZIP buffer (AES-256-cbc)...');
    const keyString = serviceRoleKey; // fallback key
    const encryptedBuffer = encryptBuffer(finalZipBuffer, keyString);
    console.log(` - Encrypted buffer size: ${formatBytes(encryptedBuffer.length)}`);

    // 5. Upload to backups bucket
    console.log('5. Uploading backup to private bucket "backups"...');
    // Ensure bucket exists
    const { data: buckets } = await adminSupabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.id === 'backups');
    if (!bucketExists) {
      console.log(' - Creating backups bucket...');
      await adminSupabase.storage.createBucket('backups', { public: false });
    }

    const testFilename = `test_backup_${Date.now()}.zip`;
    const testPath = `test_runs/${testFilename}`;

    const { error: uploadError } = await adminSupabase.storage
      .from('backups')
      .upload(testPath, encryptedBuffer, {
        contentType: 'application/zip',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    console.log(` - Backup file uploaded to path: backups/${testPath}`);

    // 6. Download & Verify integrity
    console.log('6. Downloading backup file for integrity verification...');
    const { data: downloadBlob, error: downloadError } = await adminSupabase.storage
      .from('backups')
      .download(testPath);

    if (downloadError || !downloadBlob) {
      throw new Error(`Download failed: ${downloadError?.message || 'Empty file'}`);
    }

    console.log('7. Decrypting and parsing ZIP...');
    const downloadedBuffer = Buffer.from(await downloadBlob.arrayBuffer());
    const decryptedZip = decryptBuffer(downloadedBuffer, keyString);
    const verifyZip = new AdmZip(decryptedZip);

    const dbEntry = verifyZip.getEntry('database.json');
    const metaEntry = verifyZip.getEntry('metadata.json');

    if (!dbEntry || !metaEntry) {
      throw new Error('Integrity check failed: database.json or metadata.json is missing in zip.');
    }

    const verifyMetadata = JSON.parse(verifyZip.readAsText(metaEntry));
    console.log(' - Backup integrity VERIFIED successfully!');
    console.log(' - Metadata read from backup ZIP:', verifyMetadata);

    // 8. Cleanup test backup run
    console.log('8. Cleaning up test backup run...');
    const { error: deleteError } = await adminSupabase.storage
      .from('backups')
      .remove([testPath]);
    if (deleteError) {
      console.warn('Failed to clean up test run file:', deleteError.message);
    } else {
      console.log(' - Test run file removed successfully.');
    }

    console.log('--- TEST COMPLETED SUCCESSFULLY ---');

  } catch (err) {
    console.error('--- TEST FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

function formatBytes(bytes, decimals = 2) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

run();
