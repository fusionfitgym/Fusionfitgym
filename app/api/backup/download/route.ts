import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const DEFAULT_ENCRYPTION_KEY = 'fusionfit-gym-erp-backup-secret-key';

function getEncryptionKey(): string {
  return process.env.BACKUP_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_ENCRYPTION_KEY;
}

function decryptBuffer(buffer: Buffer): Buffer {
  const keyString = getEncryptionKey();
  const key = crypto.createHash('sha256').update(keyString).digest();
  const iv = buffer.subarray(0, IV_LENGTH);
  const encryptedData = buffer.subarray(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Please log in' }, { status: 401 });
    }

    // 2. Validate role is Admin or Super Admin
    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile || (profile.role !== 'Super Admin' && profile.role !== 'Admin')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    // 3. Get path parameter
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    const filename = path.split('/').pop() || 'gym_backup.zip';
    const adminClient = createAdminClient();

    // 4. Download file from private backups bucket
    const { data: fileBlob, error: downloadError } = await adminClient.storage
      .from('backups')
      .download(path);

    if (downloadError || !fileBlob) {
      console.error('File download failed during decryption:', downloadError);
      return NextResponse.json({ error: `File not found or failed to retrieve: ${downloadError?.message || 'Empty blob'}` }, { status: 404 });
    }

    // 5. Decrypt buffer
    const encryptedBuffer = Buffer.from(await fileBlob.arrayBuffer());
    let decryptedZip: Buffer;
    try {
      decryptedZip = decryptBuffer(encryptedBuffer);
    } catch (decryptErr: any) {
      console.error('Decryption failed on download route:', decryptErr);
      return NextResponse.json({ error: 'Decryption failed: Integrity error or invalid key' }, { status: 500 });
    }

    // 6. Return response
    return new Response(new Uint8Array(decryptedZip), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (err: any) {
    console.error('Failed to run backup download route:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
