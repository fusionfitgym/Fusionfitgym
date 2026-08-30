const crypto = require('crypto').webcrypto;

const SESSION_SECRET = 'fallback-secret-fusionfit-erp-12345';
const encoder = new TextEncoder();

async function getCryptoKey() {
  const keyData = encoder.encode(SESSION_SECRET);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signSession(payload) {
  try {
    const expiry = Date.now() + 5 * 60 * 1000;
    const data = {
      id: payload.id,
      role: payload.role,
      status: payload.status,
      userId: payload.userId,
      fullName: payload.fullName,
      expiry
    };
    const dataStr = JSON.stringify(data);
    const dataBuffer = encoder.encode(dataStr);
    
    const key = await getCryptoKey();
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataBuffer);
    
    const dataHex = Array.from(dataBuffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const signatureHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return `${dataHex}:${signatureHex}`;
  } catch (error) {
    console.error("Error signing session cache:", error);
    return "";
  }
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function verifySession(cookieValue, userId) {
  try {
    if (!cookieValue || typeof cookieValue !== 'string' || !cookieValue.includes(':')) {
      return null;
    }
    const [dataHex, signatureHex] = cookieValue.split(':');
    if (!dataHex || !signatureHex) return null;

    const dataBytes = hexToBytes(dataHex);
    const signatureBytes = hexToBytes(signatureHex);
    if (!dataBytes || !signatureBytes) return null;

    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
    if (!isValid) return null;

    const dataStr = new TextDecoder().decode(dataBytes);
    const parsed = JSON.parse(dataStr);

    if (!parsed || parsed.userId !== userId) return null;
    if (typeof parsed.expiry !== 'number' || parsed.expiry < Date.now()) return null;

    return {
      id: parsed.id,
      role: parsed.role,
      status: parsed.status,
      fullName: parsed.fullName,
    };
  } catch (e) {
    console.error('Error verifying session cache:', e);
    return null;
  }
}

async function test() {
  const token = await signSession({
    id: '123',
    role: 'Super Admin',
    status: 'Active',
    fullName: 'Test Admin',
    userId: 'user-456'
  });
  console.log('Signed token:', token);
  const verified = await verifySession(token, 'user-456');
  console.log('Verified result:', verified);
  const wrongUser = await verifySession(token, 'user-789');
  console.log('Wrong user result (should be null):', wrongUser);
}

test();
