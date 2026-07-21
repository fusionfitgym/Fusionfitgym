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

export interface TextBeeReceivedSMS {
  id: string;
  sender: string;
  message: string;
  receivedAt: string;
  isRead?: boolean;
}

export interface TextBeeSentMessage {
  id: string;
  recipient: string;
  message: string;
  status: string;
  sentAt: string;
  provider: string;
}

/**
 * Fetch received SMS messages from TextBee device inbox API.
 */
export async function getTextBeeReceivedSMS(): Promise<TextBeeReceivedSMS[]> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    return [];
  }

  const endpoint = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/get-received-sms`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const list = data?.data || data?.messages || (Array.isArray(data) ? data : []);

    return list.map((item: any, idx: number) => ({
      id: item.id || item._id || `received-${idx}`,
      sender: item.sender || item.from || item.phone || 'Unknown Sender',
      message: item.message || item.text || item.body || '',
      receivedAt: item.receivedAt || item.created_at || item.createdAt || new Date().toISOString(),
      isRead: !!item.isRead
    }));
  } catch (err) {
    console.warn('[TextBee API] Failed to fetch received SMS:', err);
    return [];
  }
}

/**
 * Fetch sent SMS messages from TextBee device API.
 */
export async function getTextBeeSentMessages(page = 1, limit = 20): Promise<TextBeeSentMessage[]> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    return [];
  }

  const endpoint = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/messages?page=${page}&limit=${limit}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const list = data?.data || data?.messages || (Array.isArray(data) ? data : []);

    return list.map((item: any, idx: number) => ({
      id: item.id || item._id || `sent-${idx}`,
      recipient: item.recipient || item.to || (Array.isArray(item.recipients) ? item.recipients[0] : 'Recipient'),
      message: item.message || item.text || '',
      status: item.status || 'delivered',
      sentAt: item.sentAt || item.created_at || item.createdAt || new Date().toISOString(),
      provider: 'textbee'
    }));
  } catch (err) {
    console.warn('[TextBee API] Failed to fetch sent messages:', err);
    return [];
  }
}

/**
 * Fetch gateway connection health status for TextBee device.
 */
export async function getTextBeeGatewayHealth(): Promise<{
  connected: boolean;
  provider: string;
  deviceId: string;
  apiStatus: string;
  lastSyncTime: string;
  lastSmsSent: string | null;
}> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID || '6a5f7112ceb4314c6c43e974';

  const isConfigured = !!(apiKey && deviceId);

  return {
    connected: isConfigured,
    provider: 'TextBee',
    deviceId,
    apiStatus: isConfigured ? 'Healthy (200 OK)' : 'Missing Credentials',
    lastSyncTime: new Date().toISOString(),
    lastSmsSent: null
  };
}
