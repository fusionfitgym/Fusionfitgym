import { SMSNotificationService, getSMSNotificationService } from './notification-service';

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

// Re-export for backward compatibility
export { SMSNotificationService, getSMSNotificationService };
