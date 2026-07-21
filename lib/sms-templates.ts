/**
 * Pure SMS Template Rendering & Built-in Templates
 * Safe for both Client and Server Components (no server-only dependencies).
 */

export function renderTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`{+\\s*${key}\\s*}+`, 'g'), value);
  }
  return result;
}

export const BUILTIN_TEMPLATES = {
  renewal: `🏋️ Fusion Fit Gym

Hi {memberName},

Your membership has been renewed successfully.

📦 Plan: {planName}
📅 Renewal Date: {renewalDate}
📆 Valid Until: {expiryDate}
💰 Amount Paid: ₹{amount}

Thank you for choosing Fusion Fit Gym.
Keep training and stay healthy!`,

  invoice: `🏋️ Fusion Fit Gym

Hi {memberName},

Your payment has been received successfully.

🧾 Invoice No: {invoiceNumber}
📅 Date: {invoiceDate}
📦 Plan: {planName}
💰 Amount: ₹{amount}
💳 Payment Mode: {paymentMethod}
📆 Membership Valid Until: {expiryDate}

Thank you for choosing Fusion Fit Gym.`
};
