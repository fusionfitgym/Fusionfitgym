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
}

export async function verifySession(cookieValue: string, userId: string): Promise<CachedProfile | null> {
  try {
    const parts = cookieValue.split(':');
    if (parts.length !== 2) return null;
    const [dataHex, signatureHex] = parts;

    // Decode dataHex
    const matchData = dataHex.match(/.{1,2}/g);
    if (!matchData) return null;
    const dataBuffer = new Uint8Array(matchData.map(byte => parseInt(byte, 16)));
    const dataStr = new TextDecoder().decode(dataBuffer);

    const key = await getCryptoKey();
    
    // Decode signatureHex
    const matchSig = signatureHex.match(/.{1,2}/g);
    if (!matchSig) return null;
    const sigBuffer = new Uint8Array(matchSig.map(byte => parseInt(byte, 16))).buffer;

    const isValid = await crypto.subtle.verify('HMAC', key, sigBuffer, dataBuffer);
    if (!isValid) return null;

    const data = JSON.parse(dataStr);
    if (data.userId !== userId) return null;
    if (Date.now() > data.expiry) return null; // expired cache

    return {
      id: data.id,
      role: data.role,
      status: data.status,
      fullName: data.fullName
    };
  } catch (e) {
    console.error('Error verifying session cache:', e);
    return null;
  }
}
