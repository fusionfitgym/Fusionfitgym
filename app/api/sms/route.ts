import { NextRequest, NextResponse } from 'next/server';
import { getSMSNotificationService } from '@/lib/notification-service';
import { normalizeToE164 } from '@/lib/phone';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/sms
 * 
 * Secure server-side endpoint for direct SMS dispatch.
 * Exposes NO API keys or credentials to the client.
 * 
 * Request JSON:
 * {
 *   "phone": "+919876543210",
 *   "message": "Hello"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Malformed JSON body.' },
        { status: 400 }
      );
    }

    const { phone, message } = body;

    // 2. Validate input presence
    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid phone number in request body.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid message body.' },
        { status: 400 }
      );
    }

    // 3. Normalize phone number to E.164 format
    const normalizedPhone = normalizeToE164(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number format is invalid. Must be a valid phone number.' },
        { status: 400 }
      );
    }

    // 4. Check if SMS system is enabled globally or configured
    const providerName = process.env.SMS_PROVIDER;
    if (!providerName || providerName.toLowerCase() === 'disabled') {
      return NextResponse.json(
        { success: false, error: 'SMS provider is disabled or not configured in environment.' },
        { status: 503 }
      );
    }

    // 5. Insert log to track manual API dispatch in sms_logs
    const supabase = await createClient();

    // Detect schema columns to insert correctly
    let phoneCol = 'phone';
    let typeCol = 'sms_type';
    let isModern = false;
    try {
      const { error } = await supabase.from('sms_logs').select('phone_number').limit(1);
      if (!error) {
        phoneCol = 'phone_number';
        typeCol = 'message_type';
        isModern = true;
      }
    } catch {}

    const logData: Record<string, any> = {
      message,
      status: 'Pending',
      provider: providerName,
      attempt_count: 0
    };
    logData[phoneCol] = normalizedPhone;
    logData[typeCol] = 'API Dispatch';

    const { data: logEntry, error: insertError } = await supabase
      .from('sms_logs')
      .insert(logData)
      .select('id')
      .single();

    if (insertError) {
      console.error('[API Route SMS] Failed to queue SMS dispatch in database:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to write record to SMS queue logs.' },
        { status: 500 }
      );
    }

    // 6. Call active SMS Notification Service to dispatch (synchronously for endpoint response feedback)
    const service = getSMSNotificationService();
    const result = await service.dispatch(logEntry.id, normalizedPhone, message, null);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to dispatch SMS through provider.',
          httpStatus: result.httpStatus,
          messageId: result.messageId
        },
        { status: result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'SMS sent successfully.',
      messageId: result.messageId,
      recipient: normalizedPhone
    });

  } catch (err: any) {
    console.error('[API Route SMS] Unexpected server exception:', err);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
