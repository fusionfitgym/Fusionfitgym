export interface SMSTemplate {
  id: 'invoice' | 'membership_expired' | string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  description: string;
  category: string;
  updated_at?: string;
}

export function renderTemplate(
  template: string | { body: string; subject?: string },
  data: Record<string, string>
): string {
  const templateStr = typeof template === 'string' ? template : (template?.body || '');
  let result = templateStr;
  for (const [key, value] of Object.entries(data)) {
    // Replace {key} or {{key}} with value
    result = result.replace(new RegExp(`{+\\s*${key}\\s*}+`, 'g'), value ?? '');
  }
  return result;
}

export const BUILTIN_TEMPLATES: Record<string, { subject: string; body: string }> = {
  renewal: {
    subject: 'Membership Renewed',
    body: `🏋️ Fusion Fit Gym

Hi {memberName},

Your membership has been renewed successfully.

📦 Plan: {planName}
📅 Renewal Date: {renewalDate}
📆 Valid Until: {expiryDate}
💰 Amount Paid: ₹{amount}

View Invoice:
{invoice_link}

Thank you for choosing Fusion Fit Gym.
Keep training and stay healthy!`
  },

  invoice: {
    subject: 'Invoice Generated',
    body: `🏋️ Fusion Fit Gym

Hi {{member_name}},

Your payment has been received successfully.

🧾 Invoice No: {{invoice_number}}
📅 Date: {{invoice_date}}
📦 Plan: {{plan_name}}
💰 Amount: ₹{{amount}}
💳 Payment Mode: {{payment_method}}
📆 Membership Valid Until: {{expiry_date}}

View Invoice:
{{invoice_link}}

Thank you for choosing {{gym_name}}.`
  },

  membership_expired: {
    subject: 'Membership Expired',
    body: `Dear {{member_name}},

Your membership at {{gym_name}} expired on {{expiry_date}}.

Please renew your membership to continue enjoying our facilities.

For assistance, contact us or visit the gym.

Thank you,
{{gym_name}}`
  }
};

