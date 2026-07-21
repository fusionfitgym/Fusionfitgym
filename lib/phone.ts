/**
 * Phone Number Normalization and Validation Utility
 * Supports E.164 format (e.g., +91XXXXXXXXXX)
 */

/**
 * Normalizes a phone number to standard E.164 format.
 * Returns null if the phone number is invalid.
 * 
 * Rules:
 * - If it starts with '+', keep the '+' and strip all non-digits.
 * - If it is 10 digits (e.g., 9876543210), prepend '+91' (default country code).
 * - If it is 12 digits starting with '91', prepend '+'.
 * - Must be between 7 and 15 digits (standard E.164 length).
 * - Rejects all-zero sequences or obviously invalid strings.
 * 
 * @param phone Raw phone number string from input
 * @param defaultCountryCode Default prefix if only 10 digits are provided (defaults to '+91')
 */
export function normalizeToE164(phone: string, defaultCountryCode = '+91'): string | null {
  if (!phone) return null;

  // 1. Clean formatting characters but keep '+' if it's the leading character
  const trimPhone = phone.trim();
  const isLeadingPlus = trimPhone.startsWith('+');
  const digitsOnly = trimPhone.replace(/\D/g, '');

  if (!digitsOnly || digitsOnly.length < 7 || digitsOnly.length > 15) {
    return null;
  }

  // Reject all zeros
  if (/^0+$/.test(digitsOnly)) {
    return null;
  }

  // 2. Format based on structure
  if (isLeadingPlus) {
    return `+${digitsOnly}`;
  }

  // Handle standard India numbers without '+'
  if (digitsOnly.length === 10) {
    // e.g. 9876543210 -> +919876543210
    const cleanCC = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
    return `${cleanCC}${digitsOnly}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    // e.g. 919876543210 -> +919876543210
    return `+${digitsOnly}`;
  }

  // Fallback for other digits, prepend default country code if it doesn't look like a full international number
  if (digitsOnly.length > 10) {
    // Assume it already contains a country code but just lacks the plus
    return `+${digitsOnly}`;
  }

  // Default fallback if shorter than 10 digits but at least 7
  const cleanCC = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
  return `${cleanCC}${digitsOnly}`;
}

/**
 * Validates whether a phone number can be successfully normalized to E.164.
 */
export function isValidPhoneNumber(phone: string): boolean {
  return normalizeToE164(phone) !== null;
}
