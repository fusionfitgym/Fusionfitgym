import { createAdminClient } from './supabase/admin';
import AdmZip from 'adm-zip';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const DEFAULT_ENCRYPTION_KEY = 'fusionfit-gym-erp-backup-secret-key';

// Predefined backup order (parent-first insertion order)
const PREDEFINED_PARENT_TABLES = ['settings', 'members', 'users_profiles', 'devices'];
const PREDEFINED_CHILD_TABLES = [
  'parq_responses',
  'health_assessments',
  'invoices',
  'attendance_logs',
  'sms_logs',
  'biometric_devices',
  'sms_devices',
  'biometric_sync_logs',
  'audit_logs'
];

export interface BackupProgress {
  status: 'idle' | 'running' | 'restoring' | 'completed' | 'failed';
  step: 'idle' | 'database_export' | 'files_download' | 'compressing' | 'encrypting' | 'uploading' | 'cleanup' | 'verifying' | 'restoring_db' | 'restoring_files';
  progress: number;
  error: string | null;
  lastUpdated: string;
}

// Get the encryption key securely from environment variables
function getEncryptionKey(): string {
  return process.env.BACKUP_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ENCRYPTION_KEY;
}

// Helper to encrypt a buffer
function encryptBuffer(buffer: Buffer): Buffer {
  const keyString = getEncryptionKey();
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

// Helper to decrypt a buffer
function decryptBuffer(buffer: Buffer): Buffer {
  const keyString = getEncryptionKey();
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = buffer.subarray(0, IV_LENGTH);
  const encryptedData = buffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

// Helper to update progress in settings
export async function updateProgress(
  status: BackupProgress['status'],
  step: BackupProgress['step'],
  progress: number,
  error: string | null = null
): Promise<void> {
  const adminClient = createAdminClient();
  const progressObj: BackupProgress = {
    status,
    step,
    progress,
    error,
    lastUpdated: new Date().toISOString()
  };

  await adminClient
    .from('settings')
    .upsert(
      { key: 'backup_current_progress', value: JSON.stringify(progressObj) },
      { onConflict: 'key' }
    );
}

// Get progress status
export async function getProgress(): Promise<BackupProgress> {
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('settings')
      .select('value')
      .eq('key', 'backup_current_progress')
      .maybeSingle();

    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (err) {
    console.error('Failed to read progress status:', err);
  }

  return {
    status: 'idle',
    step: 'idle',
    progress: 0,
    error: null,
    lastUpdated: new Date().toISOString()
  };
}

// Helper: list files recursively in a storage bucket
async function listAllFiles(bucketId: string, folder: string = ''): Promise<{ path: string; name: string }[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage.from(bucketId).list(folder || undefined, {
    limit: 100,
    offset: 0
  });

  if (error) throw error;
  if (!data) return [];

  let files: { path: string; name: string }[] = [];
  for (const item of data) {
    const itemPath = folder ? `${folder}/${item.name}` : item.name;
    if (!item.id) {
      // It's a folder, traverse recursively
      const subFiles = await listAllFiles(bucketId, itemPath);
      files = files.concat(subFiles);
    } else {
      // It's a file
      files.push({ path: itemPath, name: item.name });
    }
  }
  return files;
}

// Dynamic discovery of database tables
async function getTables(adminClient: any): Promise<string[]> {
  try {
    const { data, error } = await adminClient.rpc('get_public_tables');
    if (!error && data) {
      return data.map((row: any) => typeof row === 'string' ? row : row.table_name);
    }
    console.warn('RPC get_public_tables failed or not found, falling back to predefined tables list.', error);
  } catch (err) {
    console.warn('Failed querying public tables RPC, falling back to predefined tables list.', err);
  }

  return [...PREDEFINED_PARENT_TABLES, ...PREDEFINED_CHILD_TABLES];
}

// Log backup details in history (table or settings fallback)
async function logHistory(
  filename: string,
  status: 'Success' | 'Failed' | 'In Progress',
  sizeBytes: number,
  recordsCount: number,
  errorMessage: string | null,
  durationMs: number
) {
  const adminClient = createAdminClient();
  const historyRow = {
    filename,
    status,
    size_bytes: sizeBytes,
    records_count: recordsCount,
    error_message: errorMessage,
    created_at: new Date().toISOString(),
    duration_ms: durationMs
  };

  try {
    const { error } = await adminClient.from('backup_history').insert([historyRow]);
    if (!error) return;
    console.warn('Failed to insert backup_history row directly, falling back to settings log.', error.message);
  } catch (err) {
    console.warn('Failed to log backup history in table, falling back to settings log.', err);
  }

  // Settings fallback
  try {
    const { data: settingsData } = await adminClient
      .from('settings')
      .select('value')
      .eq('key', 'backup_history_json')
      .maybeSingle();

    let logs: any[] = [];
    if (settingsData?.value) {
      logs = JSON.parse(settingsData.value);
    }
    logs.unshift({ id: crypto.randomUUID(), ...historyRow });
    // Keep last 100 history rows in settings
    logs = logs.slice(0, 100);

    await adminClient
      .from('settings')
      .upsert({ key: 'backup_history_json', value: JSON.stringify(logs) }, { onConflict: 'key' });
  } catch (err) {
    console.error('Settings backup history fallback failed:', err);
  }
}

// Core backup process (returns final path if successful)
export async function runBackup(isManual: boolean = false): Promise<string> {
  const startTime = Date.now();
  let retries = isManual ? 1 : 3;
  let attempt = 0;
  let filename = '';
  let finalPath = '';

  // Format backup date/time based on current time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  filename = `gym_backup_${year}-${month}-${day}_${hours}${minutes}.zip`;
  finalPath = `${year}/${month}/${filename}`;

  while (attempt < retries) {
    attempt++;
    try {
      console.log(`Starting backup attempt ${attempt} of ${retries}...`);
      await updateProgress('running', 'database_export', 10);

      const adminClient = createAdminClient();

      // 1. Export database tables
      const tables = await getTables(adminClient);
      const databaseData: Record<string, any[]> = {};
      let totalRecords = 0;

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        const { data, error } = await adminClient.from(table).select('*');
        if (error) {
          throw new Error(`Failed to export table ${table}: ${error.message}`);
        }
        databaseData[table] = data || [];
        totalRecords += (data?.length || 0);

        // Update progress dynamically during export (up to 40%)
        const tableProgress = 10 + Math.round((i / tables.length) * 30);
        await updateProgress('running', 'database_export', tableProgress);
      }

      // 2. Download bucket files
      await updateProgress('running', 'files_download', 45);
      const { data: buckets, error: bucketError } = await adminClient.storage.listBuckets();
      if (bucketError) {
        throw new Error(`Failed to list buckets: ${bucketError.message}`);
      }

      const filesToZip: { bucketId: string; path: string; buffer: Buffer }[] = [];
      const activeBuckets = (buckets || []).filter(b => b.id !== 'backups'); // Skip the backups bucket

      for (const bucket of activeBuckets) {
        try {
          const files = await listAllFiles(bucket.id);
          for (const file of files) {
            const { data: fileBlob, error: fileDownloadError } = await adminClient.storage
              .from(bucket.id)
              .download(file.path);
            if (fileDownloadError) {
              console.warn(`Skipping file ${file.path} in bucket ${bucket.id} due to download error:`, fileDownloadError);
              continue;
            }
            if (fileBlob) {
              const arrayBuffer = await fileBlob.arrayBuffer();
              filesToZip.push({
                bucketId: bucket.id,
                path: file.path,
                buffer: Buffer.from(arrayBuffer)
              });
            }
          }
        } catch (bucketErr) {
          console.warn(`Failed to process storage bucket ${bucket.id}:`, bucketErr);
        }
      }

      // 3. Compress ZIP
      await updateProgress('running', 'compressing', 60);
      const zip = new AdmZip();

      // Database JSON export
      zip.addFile('database.json', Buffer.from(JSON.stringify(databaseData, null, 2), 'utf8'));

      // Files assets
      for (const f of filesToZip) {
        zip.addFile(`files/${f.bucketId}/${f.path}`, f.buffer);
      }

      // Metadata JSON
      const metadata = {
        backup_date: now.toISOString(),
        erp_version: '0.1.0',
        total_records: totalRecords,
        file_size: 0 // Will populate next
      };

      zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

      const zipBuffer = zip.toBuffer();
      metadata.file_size = zipBuffer.length;

      // Re-add updated metadata with size
      zip.deleteFile('metadata.json');
      zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

      const finalZipBuffer = zip.toBuffer();

      // 4. Encrypt ZIP
      await updateProgress('running', 'encrypting', 75);
      const encryptedBuffer = encryptBuffer(finalZipBuffer);

      // 5. Upload Backup
      await updateProgress('running', 'uploading', 85);
      
      // Ensure 'backups' bucket exists
      const { data: currentBuckets } = await adminClient.storage.listBuckets();
      const backupsBucketExists = currentBuckets?.some(b => b.id === 'backups');
      if (!backupsBucketExists) {
        await adminClient.storage.createBucket('backups', { public: false });
      }

      const { error: uploadError } = await adminClient.storage
        .from('backups')
        .upload(finalPath, encryptedBuffer, {
          contentType: 'application/zip',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload encrypted backup: ${uploadError.message}`);
      }

      // 6. Verify Backup Integrity
      await updateProgress('running', 'verifying', 90);
      const { data: downloadVerifyBlob, error: downloadVerifyErr } = await adminClient.storage
        .from('backups')
        .download(finalPath);

      if (downloadVerifyErr || !downloadVerifyBlob) {
        throw new Error(`Backup integrity check failed to download: ${downloadVerifyErr?.message || 'Empty file'}`);
      }

      const verifyBuffer = Buffer.from(await downloadVerifyBlob.arrayBuffer());
      const decryptedVerifyZip = decryptBuffer(verifyBuffer);
      const verifyZip = new AdmZip(decryptedVerifyZip);
      const verifyDbEntry = verifyZip.getEntry('database.json');
      const verifyMetaEntry = verifyZip.getEntry('metadata.json');

      if (!verifyDbEntry || !verifyMetaEntry) {
        throw new Error('Backup integrity verification failed: Missing database.json or metadata.json in ZIP archive.');
      }

      // 7. Apply Retention Policy (keep latest 30 backups)
      await updateProgress('running', 'cleanup', 95);
      const { data: backupFiles, error: listBackupsError } = await adminClient.storage
        .from('backups')
        .list('', { limit: 100, sortBy: { column: 'name', order: 'desc' } }); // We list folders or recursively traverse

      if (!listBackupsError && backupFiles) {
        // Find all zip backup paths recursively
        const allBackupPaths: { path: string; name: string; created_at: string }[] = [];
        
        // Storage buckets can have folders like 2026/06/...
        // We list recursively by checking subfolders
        const { data: yearFolders } = await adminClient.storage.from('backups').list('', { limit: 100 });
        for (const yr of yearFolders || []) {
          if (!yr.id) { // Year folder
            const { data: monthFolders } = await adminClient.storage.from('backups').list(yr.name, { limit: 12 });
            for (const mo of monthFolders || []) {
              if (!mo.id) { // Month folder
                const { data: backupZips } = await adminClient.storage.from('backups').list(`${yr.name}/${mo.name}`, { limit: 100 });
                for (const zipItem of backupZips || []) {
                  if (zipItem.id && zipItem.name.endsWith('.zip')) {
                    allBackupPaths.push({
                      path: `${yr.name}/${mo.name}/${zipItem.name}`,
                      name: zipItem.name,
                      created_at: zipItem.created_at || zipItem.updated_at || ''
                    });
                  }
                }
              }
            }
          }
        }

        // Sort all backups by date (newest first)
        allBackupPaths.sort((a, b) => b.name.localeCompare(a.name));

        if (allBackupPaths.length > 30) {
          const obsoleteBackups = allBackupPaths.slice(30);
          console.log(`Deleting ${obsoleteBackups.length} obsolete backups to satisfy retention limit...`);
          const pathsToDelete = obsoleteBackups.map(b => b.path);
          const { error: removeError } = await adminClient.storage.from('backups').remove(pathsToDelete);
          if (removeError) {
            console.error('Failed to delete obsolete backups during retention policy check:', removeError.message);
          }
        }
      }

      // Success logging and progress finalization
      const durationMs = Date.now() - startTime;
      await logHistory(filename, 'Success', encryptedBuffer.length, totalRecords, null, durationMs);
      await updateProgress('completed', 'idle', 100);

      // Save last successful run timestamp to settings
      await adminClient
        .from('settings')
        .upsert({ key: 'backup_last_successful_run', value: new Date().toISOString() }, { onConflict: 'key' });

      console.log(`Backup completed successfully: ${finalPath}`);
      return finalPath;
    } catch (err: any) {
      console.error(`Backup attempt ${attempt} failed:`, err.message || err);
      if (attempt >= retries) {
        const durationMs = Date.now() - startTime;
        await logHistory(filename, 'Failed', 0, 0, err.message || 'Unknown error during backup', durationMs);
        await updateProgress('failed', 'idle', 0, err.message || 'Backup failed');
        throw err;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Backup failed after all retry attempts.');
}

// Core restore process
export async function runRestore(backupPath: string): Promise<void> {
  const startTime = Date.now();
  console.log(`Starting restore process for backup: ${backupPath}...`);
  
  try {
    await updateProgress('restoring', 'restoring_db', 5);
    const adminClient = createAdminClient();

    // 1. Download Backup ZIP
    const { data: downloadBlob, error: downloadErr } = await adminClient.storage
      .from('backups')
      .download(backupPath);

    if (downloadErr || !downloadBlob) {
      throw new Error(`Failed to download backup for restore: ${downloadErr?.message || 'Empty file'}`);
    }

    // 2. Decrypt & Extract
    await updateProgress('restoring', 'restoring_db', 15);
    const verifyBuffer = Buffer.from(await downloadBlob.arrayBuffer());
    let decryptedZip: Buffer;
    try {
      decryptedZip = decryptBuffer(verifyBuffer);
    } catch (decryptErr: any) {
      throw new Error(`Failed to decrypt backup. Key might be invalid: ${decryptErr.message}`);
    }

    const zip = new AdmZip(decryptedZip);
    const dbEntry = zip.getEntry('database.json');
    const metaEntry = zip.getEntry('metadata.json');

    if (!dbEntry || !metaEntry) {
      throw new Error('Invalid backup package: Missing database.json or metadata.json');
    }

    const databaseData = JSON.parse(zip.readAsText(dbEntry));
    const metadata = JSON.parse(zip.readAsText(metaEntry));

    // 3. AUTOMATIC SAFETY BACKUP (Crucial requirement before restoring!)
    await updateProgress('restoring', 'restoring_db', 25);
    console.log('Creating pre-restore safety backup...');
    try {
      await runBackup(true); // manual force backup to prevent loops
    } catch (safetyErr: any) {
      console.warn('Pre-restore safety backup failed, but continuing with restore...', safetyErr.message);
    }

    // Restore UI state
    await updateProgress('restoring', 'restoring_db', 40);

    // 4. Truncate tables using our new postgres RPC
    console.log('Truncating database public tables...');
    const { error: truncateError } = await adminClient.rpc('truncate_public_tables');
    if (truncateError) {
      // Fallback manual truncate table-by-table if RPC is missing
      console.warn('RPC truncate_public_tables failed, attempting manual clean...', truncateError.message);
      const tablesToDelete = [...PREDEFINED_CHILD_TABLES, ...PREDEFINED_PARENT_TABLES];
      for (const tbl of tablesToDelete) {
        try {
          await adminClient.from(tbl).delete().filter('key', 'neq', ''); // For settings
          await adminClient.from(tbl).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // For UUID id tables
        } catch (cleanErr: any) {
          console.warn(`Fallback cleaning for table ${tbl} encountered warnings:`, cleanErr.message);
        }
      }
    }

    // 5. Restore database rows in topological order
    console.log('Inserting database records...');
    const tablesToInsert = [...PREDEFINED_PARENT_TABLES, ...PREDEFINED_CHILD_TABLES];
    
    // Add any unknown tables from backup at the end
    const exportedTables = Object.keys(databaseData);
    for (const extTbl of exportedTables) {
      if (!tablesToInsert.includes(extTbl)) {
        tablesToInsert.push(extTbl);
      }
    }

    for (let i = 0; i < tablesToInsert.length; i++) {
      const table = tablesToInsert[i];
      const rows = databaseData[table] || [];
      if (rows.length === 0) continue;

      console.log(`Restoring ${rows.length} rows for table: ${table}...`);
      
      // Batch inserts to prevent payload limitations
      const batchSize = 100;
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        const batch = rows.slice(offset, offset + batchSize);
        const { error: insertError } = await adminClient.from(table).insert(batch);
        if (insertError) {
          throw new Error(`Failed to restore records for table ${table}: ${insertError.message}`);
        }
      }

      // Update progress dynamically (up to 75%)
      const dbProgress = 40 + Math.round((i / tablesToInsert.length) * 35);
      await updateProgress('restoring', 'restoring_db', dbProgress);
    }

    // 6. Restore files to storage buckets
    await updateProgress('restoring', 'restoring_files', 80);
    console.log('Restoring storage bucket files...');

    const zipEntries = zip.getEntries();
    const storageFiles = zipEntries.filter(entry => entry.entryName.startsWith('files/') && !entry.isDirectory);

    // List and empty existing storage buckets first
    const { data: buckets } = await adminClient.storage.listBuckets();
    const activeBuckets = (buckets || []).filter(b => b.id !== 'backups');

    for (const bucket of activeBuckets) {
      try {
        const files = await listAllFiles(bucket.id);
        if (files.length > 0) {
          const filePaths = files.map(f => f.path);
          await adminClient.storage.from(bucket.id).remove(filePaths);
        }
      } catch (err: any) {
        console.warn(`Failed to empty bucket ${bucket.id} during restore:`, err.message);
      }
    }

    // Upload files from ZIP
    for (let i = 0; i < storageFiles.length; i++) {
      const entry = storageFiles[i];
      // Path format: files/bucket_id/file_path
      const parts = entry.entryName.split('/');
      const bucketId = parts[1];
      const filePath = parts.slice(2).join('/');
      const fileBuffer = entry.getData();

      // Ensure target bucket exists
      const { data: targetBuckets } = await adminClient.storage.listBuckets();
      const bucketExists = targetBuckets?.some(b => b.id === bucketId);
      if (!bucketExists) {
        await adminClient.storage.createBucket(bucketId, { public: true });
      }

      const { error: uploadError } = await adminClient.storage
        .from(bucketId)
        .upload(filePath, fileBuffer, { upsert: true });

      if (uploadError) {
        console.warn(`Failed to restore file ${filePath} to bucket ${bucketId}:`, uploadError.message);
      }

      // Update progress dynamically (up to 95%)
      const fileProgress = 80 + Math.round((i / storageFiles.length) * 15);
      await updateProgress('restoring', 'restoring_files', fileProgress);
    }

    await updateProgress('completed', 'idle', 100);
    console.log(`Restore completed successfully from backup: ${backupPath}`);
  } catch (err: any) {
    console.error('Restore operation failed:', err);
    await updateProgress('failed', 'idle', 0, err.message || 'Restore failed');
    throw err;
  }
}
