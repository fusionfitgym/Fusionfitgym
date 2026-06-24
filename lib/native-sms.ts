/**
 * Native SMS Utility — opens the device's default SMS application.
 *
 * No SMS gateway, no API, no backend — purely uses the native sms: URI scheme.
 * The user manually presses "Send" in the SMS app.
 */

/**
 * Opens the device default SMS app with the given phone and message.
 * @returns true on success, false when phone is missing
 */
export function openNativeSms(phone: string | null | undefined, message: string): boolean {
  const cleaned = phone?.replace(/\s+/g, '').trim();
  if (!cleaned) return false;

  // RFC 5724 SMS URI — works on Android, iOS, and most desktop clients
  const uri = `sms:${cleaned}?body=${encodeURIComponent(message)}`;
  window.open(uri, '_self');
  return true;
}

/** Generates the membership expiry reminder message */
export function buildExpiryReminderMessage(
  memberName: string,
  expiryDate: string,
  gymPhone = '+91 XXXXX XXXXX',
): string {
  return [
    `Hello ${memberName},`,
    '',
    `Your Fusion Fit Gym membership will expire on ${expiryDate}.`,
    '',
    'Please renew your membership to continue enjoying our facilities.',
    '',
    'Fusion Fit Gym',
    gymPhone,
  ].join('\n');
}

/** Generates the invoice notification message */
export function buildInvoiceMessage(
  memberName: string,
  invoiceNumber: string,
  amount: string,
): string {
  return [
    `Hello ${memberName},`,
    '',
    'Your invoice has been generated.',
    '',
    `Invoice No: ${invoiceNumber}`,
    `Amount: ${amount}`,
    '',
    'Thank you for choosing Fusion Fit Gym.',
  ].join('\n');
}
