const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const apiKeyMatch = envContent.match(/TEXTBEE_API_KEY=(.+)/);
const deviceIdMatch = envContent.match(/TEXTBEE_DEVICE_ID=(.+)/);

const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';
const deviceId = deviceIdMatch ? deviceIdMatch[1].trim() : '';

console.log('Using API Key from .env.local:', apiKey);
console.log('Using Device ID from .env.local:', deviceId);

async function test() {
  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipients: ['+919497013275'],
      message: 'Test message from FusionFit node script'
    })
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text);
}

test();
