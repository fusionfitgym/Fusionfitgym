import { randomBytes } from 'crypto';

/** Generate a URL-safe random token for public invoice links */
export function generateInvoiceToken(): string {
  return randomBytes(16).toString('hex');
}

/** Resolve the application base URL (server or client) */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return window.location.origin;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'https://fusionfitgym.vercel.app';
}

/** Build the public online invoice URL (primary format: /invoice/{token}) */
export function buildInvoicePublicUrl(token: string, baseUrl?: string): string {
  const base = (baseUrl || getAppBaseUrl()).replace(/\/$/, '');
  return `${base}/invoice/${token}`;
}

/** Build short public online invoice URL (/i/{token}) */
export function buildInvoiceShortUrl(token: string, baseUrl?: string): string {
  const base = (baseUrl || getAppBaseUrl()).replace(/\/$/, '');
  return `${base}/i/${token}`;
}

export const INVOICE_SMS_TEMPLATE = `Hi {{member_name}},
Your FusionFit Gym invoice is ready.

Invoice No: {{invoice_number}}
Amount: ₹{{amount}}

View Invoice:
{{invoice_link}}

Thank you.
- FusionFit Gym`;

/** Standard invoice SMS body with all placeholders resolved */
export function buildInvoiceSmsMessage(params: {
  memberName: string;
  invoiceNumber: string;
  amount: number | string;
  invoiceLink: string;
}): string {
  const amount =
    typeof params.amount === 'number'
      ? params.amount.toLocaleString('en-IN')
      : params.amount.replace(/^₹\s*/, '');

  return INVOICE_SMS_TEMPLATE.replace(/{{\s*member_name\s*}}/g, params.memberName)
    .replace(/{{\s*invoice_number\s*}}/g, params.invoiceNumber)
    .replace(/{{\s*amount\s*}}/g, amount)
    .replace(/{{\s*invoice_link\s*}}/g, params.invoiceLink);
}
