import { createClient } from '@/lib/supabase/server';
import { withRetry } from './retry';

export interface SMSResult {
  success: boolean;
  messageId?: string;
  httpStatus?: number;
  rawResponse?: unknown;
  error?: string;
}

export interface SMSProvider {
  readonly name: string;
  send(phone: string, message: string): Promise<SMSResult>;
}

/**
 * Factory function to retrieve the active SMS provider based on environment variables.
 */
export function getActiveProvider(): SMSProvider | null {
  const providerName = process.env.SMS_PROVIDER?.toLowerCase().trim();

  if (providerName === 'textbee') {
    // Dynamic import to avoid loading provider-specific modules if not configured
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextBeeProvider } = require('./textbee');
    return new TextBeeProvider();
  }

  // Future providers can be added here
  // else if (providerName === 'twilio') { ... }

  return null;
}

/**
 * SMS Notification Service
 * Orchestrates phone normalization, gateway dispatch (with retries), and DB logging.
 */
export class SMSNotificationService {
  private provider: SMSProvider | null;

  constructor() {
    this.provider = getActiveProvider();
  }

  /**
   * Dispatches a pending SMS log to the active provider.
   * Updates the database log with success/failure status and metadata.
   * 
   * @param logId The database ID of the SMS log in sms_logs
   * @param phone Recipient's phone number
   * @param message Text message content
   * @param memberId Associated member's UUID (if any)
   */
  async dispatch(
    logId: string,
    phone: string,
    message: string,
    memberId: string | null
  ): Promise<SMSResult> {
    if (!this.provider) {
      console.log(`[SMS Notification Service] No active SMS provider configured or SMS_PROVIDER is disabled.`);
      return { success: false, error: 'No active provider' };
    }

    console.log(`[SMS Notification Service] Starting dispatch using provider: ${this.provider.name} for log ID: ${logId}`);

    const supabase = await createClient();

    // Detect schema columns to update correctly
    let isModern = false;
    try {
      const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
      if (!error) {
        isModern = true;
      }
    } catch {}

    const attemptTime = new Date().toISOString();

    // Fetch current attempt count to increment safely
    let nextCount = 1;
    try {
      const { data: currentLog } = await supabase
        .from('sms_logs')
        .select('attempt_count')
        .eq('id', logId)
        .single();
      if (currentLog && currentLog.attempt_count !== undefined && currentLog.attempt_count !== null) {
        nextCount = Number(currentLog.attempt_count) + 1;
      }
    } catch (fetchErr) {
      console.warn('[SMS Notification Service] Failed to fetch current attempt count:', fetchErr);
    }

    // Increment attempt count in database before trying
    try {
      const preUpdateData: Record<string, any> = {
        last_attempt_at: attemptTime
      };
      if (isModern) {
        preUpdateData.attempt_count = nextCount;
      }
      await supabase
        .from('sms_logs')
        .update(preUpdateData)
        .eq('id', logId);
    } catch (dbErr) {
      console.warn('[SMS Notification Service] Failed to pre-update attempt metadata in DB:', dbErr);
    }

    let result: SMSResult;
    try {
      // Execute the provider send operation with 1 retry (2 total attempts)
      result = await withRetry(
        () => this.provider!.send(phone, message),
        1,
        500
      );
    } catch (dispatchErr: any) {
      result = {
        success: false,
        error: dispatchErr?.message || String(dispatchErr),
        rawResponse: dispatchErr
      };
    }

    const completionTime = new Date().toISOString();

    // Prepare metadata
    const providerMetadata = {
      provider: this.provider.name,
      status: result.success ? 'sent' : 'failed',
      httpStatus: result.httpStatus,
      messageId: result.messageId,
      error: result.error,
      completedAt: completionTime,
      attempts: result.success ? 1 : 2, // approximation for retry metadata
      rawResponse: result.rawResponse
    };

    // Update database log
    try {
      const statusValue = result.success ? 'Sent' : 'Failed';
      const updateData: Record<string, any> = {
        status: statusValue,
        provider: this.provider.name,
        provider_metadata: providerMetadata,
      };

      if (isModern) {
        updateData.sent_at = result.success ? completionTime : null;
      } else {
        updateData.provider_response = result.success 
          ? `Sent successfully via ${this.provider.name}. ID: ${result.messageId || 'N/A'}`
          : `Failed via ${this.provider.name}. Error: ${result.error || 'Unknown'}`;
      }

      const { error: updateError } = await supabase
        .from('sms_logs')
        .update(updateData)
        .eq('id', logId);

      if (updateError) {
        throw updateError;
      }

      // If successful and there's an associated member, update member's SMS tracking columns
      if (result.success && memberId) {
        await supabase
          .from('members')
          .update({
            sms_sent: true,
            sms_sent_at: completionTime,
            sms_status: 'sent',
          })
          .eq('id', memberId);
      }
    } catch (dbErr) {
      console.error('[SMS Notification Service] Failed to update SMS logs with completion details:', dbErr);
    }

    return result;
  }
}

// Single instance factory helper
let serviceInstance: SMSNotificationService | null = null;

export function getSMSNotificationService(): SMSNotificationService {
  if (!serviceInstance) {
    serviceInstance = new SMSNotificationService();
  }
  return serviceInstance;
}
