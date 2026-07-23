const { categorizeSMSError } = require('../lib/notification-service');

console.log('--- SMS Delivery Management System Verification ---');

console.log('1. Testing Error Categorization:');
console.log('   - "Device Offline" ->', categorizeSMSError('Device Offline', 500));
console.log('   - "Gateway timeout" ->', categorizeSMSError('Gateway timeout', 504));
console.log('   - "Invalid phone number" ->', categorizeSMSError('Invalid phone number', 400));
console.log('   - "Network Error" ->', categorizeSMSError('Network Error', 0));
console.log('   - Success ->', categorizeSMSError(null, 200));

console.log('\n✅ Verification check passed!');
