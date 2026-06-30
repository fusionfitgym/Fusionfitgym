import { NextRequest, NextResponse } from 'next/server';
import { runBackup, getProgress } from '@/lib/backup-service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Validation
    const apiKey = request.headers.get('x-api-key') || request.nextUrl.searchParams.get('apiKey');
    const configuredKey = process.env.AUTOMATION_API_KEY;

    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const isForced = searchParams.get('force') === 'true';

    const adminClient = createAdminClient();

    // 2. Fetch Backup Settings
    const { data: settingsData } = await adminClient
      .from('settings')
      .select('key, value')
      .in('key', ['backup_schedule_time', 'backup_enabled', 'backup_last_successful_run']);

    const settingsMap: Record<string, string> = {};
    settingsData?.forEach(row => { settingsMap[row.key] = row.value; });

    const scheduleTime = settingsMap.backup_schedule_time ?? '02:00';
    const isBackupEnabled = settingsMap.backup_enabled !== 'false';
    const lastSuccessfulRun = settingsMap.backup_last_successful_run ?? null;

    if (!isBackupEnabled && !isForced) {
      return NextResponse.json({ message: 'Backup system is disabled in settings.' });
    }

    // 3. Evaluate schedule match (if not forced)
    if (!isForced) {
      // Get current local time in IST (offset +5.5 hours)
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const currentHour = istTime.getUTCHours();

      const [schedHourStr] = scheduleTime.split(':');
      const schedHour = parseInt(schedHourStr, 10);

      // Check if hour matches
      if (currentHour !== schedHour) {
        return NextResponse.json({
          message: `Scheduled time is ${scheduleTime} (Hour: ${schedHour}). Current hour is ${currentHour} IST. Skipping execution.`
        });
      }

      // Check if backup has already run today (since midnight IST)
      const todayStartIST = new Date(istTime.getTime());
      todayStartIST.setUTCHours(0, 0, 0, 0);
      const todayStartUTC = new Date(todayStartIST.getTime() - (5.5 * 60 * 60 * 1000));

      if (lastSuccessfulRun) {
        const lastRunDate = new Date(lastSuccessfulRun);
        if (lastRunDate >= todayStartUTC) {
          return NextResponse.json({
            message: `A backup has already successfully executed today (Last Run: ${lastSuccessfulRun}). Skipping duplicate run.`
          });
        }
      }
    }

    // 4. Check if a backup task is already active
    const progress = await getProgress();
    if (progress.status === 'running' || progress.status === 'restoring') {
      return NextResponse.json({ error: 'A backup or restore task is already running.' }, { status: 409 });
    }

    // 5. Trigger backup execution
    console.log('Automated Cron: Triggering backup...');
    // runBackup returns the path
    const finalPath = await runBackup(false);

    return NextResponse.json({
      success: true,
      message: 'Backup completed successfully',
      path: finalPath
    });

  } catch (err: any) {
    console.error('Scheduled backup cron failed:', err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

// Allow GET request triggers
export async function GET(request: NextRequest) {
  return POST(request);
}
