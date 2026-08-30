const SESSION_SECRET = process.env.SESSION_SECRET || 'fallback-secret-fusionfit-erp-12345';
const encoder = new TextEncoder();

async function getCryptoKey(): Promise<CryptoKey> {
  const keyData = encoder.encode(SESSION_SECRET);
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface CachedProfile {
  id: string;
  role: 'Super Admin' | 'Admin' | 'Receptionist' | 'Trainer';
  status: 'Active' | 'Suspended';
  fullName: string;
}

export async function signSession(payload: CachedProfile & { userId: string }): Promise<string> {
  try {
    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes cache TTL
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
    
    // Hex encode payload and signature
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

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function verifySession(cookieValue: string, userId: string): Promise<CachedProfile | null> {
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

