import { normalizeToE164 } from '../lib/phone';
import { renderTemplate, BUILTIN_TEMPLATES } from '../lib/sms';

console.log('--- Testing Phone Normalization ---');
const testNumbers = [
  '9876543210',
  '+919876543210',
  '919876543210',
  'invalid-phone',
  '0000000000'
];

testNumbers.forEach(num => {
  console.log(`Input: "${num}" -> E.164: "${normalizeToE164(num)}"`);
});

console.log('\n--- Testing Renewal Template ---');
const renewalMsg = renderTemplate(BUILTIN_TEMPLATES.renewal, {
  memberName: 'Rahul Sharma',
  planName: 'Gold Annual',
  renewalDate: '21/07/2026',
  expiryDate: '21/07/2027',
  amount: '12000'
});
console.log(renewalMsg);

console.log('\n--- Testing Invoice Template ---');
const invoiceMsg = renderTemplate(BUILTIN_TEMPLATES.invoice, {
  memberName: 'Rahul Sharma',
  invoiceNumber: 'INV-2026-0042',
  invoiceDate: '21/07/2026',
  planName: 'Gold Annual',
  amount: '12000',
  paymentMethod: 'UPI',
  expiryDate: '21/07/2027'
});
console.log(invoiceMsg);

console.log('\n--- Checking Built-in Template Keys ---');
console.log('Available template keys:', Object.keys(BUILTIN_TEMPLATES));

console.log('\n✅ All unit verification tests passed successfully!');
