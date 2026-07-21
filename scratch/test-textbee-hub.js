const { normalizeToE164 } = require('../lib/phone');

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

console.log('\n--- Environment Configuration ---');
console.log('SMS_PROVIDER:', process.env.SMS_PROVIDER || 'textbee');
console.log('TEXTBEE_API_KEY present:', !!process.env.TEXTBEE_API_KEY);
console.log('TEXTBEE_DEVICE_ID present:', !!process.env.TEXTBEE_DEVICE_ID);

console.log('\n✅ Verification script complete.');
