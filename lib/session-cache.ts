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

export async function verifySession(cookieValue: string, userId: string): Promise<CachedProfile | null> {
  try {
    // Temporarily bypass session cache logic to avoid signature validation crashes and fallback to DB
    return null;
  } catch (e) {
    console.error('Error verifying session cache:', e);
    return null;
  }
}

