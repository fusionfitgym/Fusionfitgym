import { SMSProvider, SMSResult } from './sms-provider';
import { normalizeToE164 } from './phone';

interface TextBeeSuccessResponse {
  success: boolean;
  message?: string;
  data?: {
    id?: string;
    [key: string]: unknown;
  };
}

/**
 * TextBee SMS Gateway Provider
 * Implements SMSProvider interface.
 */
export class TextBeeProvider implements SMSProvider {
  readonly name = 'textbee';

  /**
   * Dispatches SMS using the TextBee API gateway.
   * Uses AbortController to implement a 10s request timeout.
   * 
   * @param phone Recipient phone number (will be normalized to E.164)
   * @param message Text message body
   */
  async send(phone: string, message: string): Promise<SMSResult> {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) {
      const errorMsg = 'Missing TextBee credentials (TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID)';
      console.error(`[TextBee Provider] Config Error: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    }

    // 1. Normalize phone to E.164
    const normalizedPhone = normalizeToE164(phone);
    if (!normalizedPhone) {
      console.error(`[TextBee Provider] Invalid phone number passed: ${phone}`);
      return {
        success: false,
        error: 'Invalid phone number'
      };
    }

    const endpoint = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

    // 2. Set up timeout protection (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      console.log(`[TextBee Provider] Sending SMS to ${normalizedPhone} via device ${deviceId}...`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipients: [normalizedPhone],
          message: message
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData: TextBeeSuccessResponse | null = null;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn(`[TextBee Provider] Failed to parse response as JSON. Raw response: ${responseText}`);
      }

      const httpStatus = response.status;

      if (!response.ok) {
        const errorMsg = responseData?.message || `HTTP Error ${httpStatus}: ${responseText}`;
        console.error(`[TextBee Provider] HTTP request failed with status ${httpStatus}. Error: ${errorMsg}`);
        return {
          success: false,
          httpStatus,
          error: errorMsg,
          rawResponse: responseData || responseText
        };
      }

      const messageId = responseData?.data?.id || responseData?.message || 'delivered';

      console.log(`[TextBee Provider] SMS sent successfully. Message ID: ${messageId}`);
      return {
        success: true,
        messageId,
        httpStatus,
        rawResponse: responseData
      };

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        console.error('[TextBee Provider] HTTP Request timed out after 10 seconds.');
        return {
          success: false,
          error: 'Gateway timeout (10 seconds exceeded)',
          rawResponse: error
        };
      }

      console.error('[TextBee Provider] Unexpected network or client error:', error);
      return {
        success: false,
        error: error?.message || String(error),
        rawResponse: error
      };
    }
  }
}
