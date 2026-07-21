import { createClient } from '@/lib/supabase/server';
import { getActiveProvider, SMSProvider, SMSResult } from './sms-provider';
import { withRetry } from './retry';
import { getGlobalRateLimiter } from './rate-limiter';

/**
 * SMS Notification Service
 * Core orchestrator for gateway dispatches, rate limiting, retries, and database log sync.
 */
export class SMSNotificationService {
  private provider: SMSProvider | null;

  constructor() {
    this.provider = getActiveProvider();
  }

  /**
   * Dispatches a pending SMS log entry to the active gateway provider.
   * Updates the database log with success/failure status and metadata.
   * 
   * @param logId Database ID of the log entry in sms_logs
   * @param phone Recipient's phone number
   * @param message Text message body
   * @param memberId Associated member UUID (optional)
   */
  async dispatch(
    logId: string,
    phone: string,
    message: string,
    memberId: string | null
  ): Promise<SMSResult> {
    if (!this.provider) {
      console.log(`[SMS Notification Service] No active SMS provider configured (SMS_PROVIDER is disabled or missing).`);
      return { success: false, error: 'No active provider' };
    }

    console.log(`[SMS Notification Service] Starting dispatch via ${this.provider.name} for log ID: ${logId}`);

    const supabase = await createClient();

    // Detect database schema columns
    let isModern = false;
    try {
      const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
      if (!error) {
        isModern = true;
      }
    } catch {}

    const attemptTime = new Date().toISOString();

    // Fetch current attempt count to increment
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
      console.warn('[SMS Notification Service] Could not fetch attempt count:', fetchErr);
    }

    // Pre-update database log metadata prior to provider call
    try {
      const preUpdateData: Record<string, any> = {
        last_attempt_at: attemptTime,
        provider: this.provider.name,
      };
      if (isModern) {
        preUpdateData.attempt_count = nextCount;
      }
      await supabase
        .from('sms_logs')
        .update(preUpdateData)
        .eq('id', logId);
    } catch (dbErr) {
      console.warn('[SMS Notification Service] Pre-update attempt metadata failed:', dbErr);
    }

    let result: SMSResult;
    try {
      // 1. Acquire rate limiter token before dispatching to provider
      const limiter = getGlobalRateLimiter();
      await limiter.acquireToken();

      // 2. Execute provider send operation with 1 retry (2 total attempts max)
      result = await withRetry(
        () => this.provider!.send(phone, message),
        1,
        500
      );
    } catch (dispatchErr: any) {
      result = {
        success: false,
        error: dispatchErr?.message || String(dispatchErr),
        rawResponse: dispatchErr,
      };
    }

    const completionTime = new Date().toISOString();

    // Build provider metadata payload
    const providerMetadata = {
      provider: this.provider.name,
      status: result.success ? 'sent' : 'failed',
      httpStatus: result.httpStatus,
      messageId: result.messageId,
      error: result.error,
      completedAt: completionTime,
      rawResponse: result.rawResponse,
    };

    // Update database log entry with completion details
    try {
      const statusValue = result.success ? 'Sent' : 'Failed';
      const updateData: Record<string, any> = {
        status: statusValue,
        provider: this.provider.name,
        provider_metadata: providerMetadata,
      };

      if (result.messageId) {
        updateData.provider_message_id = result.messageId;
      }

      if (isModern) {
        updateData.sent_at = result.success ? completionTime : null;
      } else {
        updateData.provider_response = result.success
          ? `Sent via ${this.provider.name}. ID: ${result.messageId || 'N/A'}`
          : `Failed via ${this.provider.name}. Error: ${result.error || 'Unknown'}`;
      }

      const { error: updateError } = await supabase
        .from('sms_logs')
        .update(updateData)
        .eq('id', logId);

      if (updateError) {
        // Fallback update without optional columns if schema differs
        delete updateData.provider_message_id;
        await supabase
          .from('sms_logs')
          .update(updateData)
          .eq('id', logId);
      }

      // Update associated member record if dispatch succeeded
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
      console.error('[SMS Notification Service] Failed to write log completion details:', dbErr);
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
