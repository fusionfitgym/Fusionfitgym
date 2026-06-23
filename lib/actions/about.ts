"use server";

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface SystemStatus {
  database: 'Operational' | 'Error';
  auth: 'Operational' | 'Error';
  storage: 'Operational' | 'Error';
  sms: 'Operational' | 'Disabled' | 'Error';
  api: {
    status: 'Operational' | 'Error';
    latencyMs: number;
  };
}

export async function checkSystemStatus(): Promise<SystemStatus> {
  const startTime = Date.now();
  const status: SystemStatus = {
    database: 'Error',
    auth: 'Error',
    storage: 'Error',
    sms: 'Disabled',
    api: {
      status: 'Operational',
      latencyMs: 0,
    },
  };

  try {
    const supabase = await createClient();

    // 1. Database Check
    const { error: dbError } = await supabase.from('settings').select('key', { count: 'exact', head: true }).limit(1);
    if (!dbError) {
      status.database = 'Operational';
    } else {
      console.error('Status DB Check Error:', dbError.message);
    }

    // 2. Auth Check
    const { error: authError } = await supabase.auth.getSession();
    if (!authError) {
      status.auth = 'Operational';
    } else {
      console.error('Status Auth Check Error:', authError.message);
    }

    // 3. Storage Check
    try {
      const adminClient = createAdminClient();
      const { error: storageError } = await adminClient.storage.listBuckets();
      if (!storageError) {
        status.storage = 'Operational';
      } else {
        console.error('Status Storage Check Error:', storageError.message);
      }
    } catch (err) {
      console.error('Status Storage Client Error:', err);
    }

    // 4. SMS Check
    try {
      const { data: smsSettings, error: smsError } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['sms_enabled', 'sms_api_key']);
      
      if (!smsError && smsSettings) {
        const isEnabled = smsSettings.find((s: any) => s.key === 'sms_enabled')?.value === 'true';
        const hasKey = !!smsSettings.find((s: any) => s.key === 'sms_api_key')?.value;
        if (isEnabled) {
          status.sms = hasKey ? 'Operational' : 'Error';
        } else {
          status.sms = 'Disabled';
        }
      }
    } catch (err) {
      console.error('Status SMS Check Error:', err);
    }

    // 5. API Latency Check
    status.api.latencyMs = Date.now() - startTime;
  } catch (globalError) {
    console.error('System status check failed:', globalError);
    status.api.status = 'Error';
  }

  return status;
}
