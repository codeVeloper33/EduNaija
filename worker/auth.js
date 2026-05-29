/**
 * EduNaija Worker — auth.js
 * Verifies Firebase ID tokens using Google's public keys
 * No Firebase Admin SDK needed — pure JWT verification
 */

const FIREBASE_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

// Cache public keys for 1 hour
let cachedKeys = null;
let keyCacheExpiry = 0;

async function getFirebasePublicKeys() {
  const now = Date.now();
  if (cachedKeys && now < keyCacheExpiry) return cachedKeys;

  const res = await fetch(FIREBASE_KEYS_URL);
  const keys = await res.json();

  // Cache until max-age from response headers
  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600000;

  cachedKeys = keys;
  keyCacheExpiry = now + maxAge;
  return keys;
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  const binary = atob(padded);
  return new TextEncoder().encode(binary);
}

function parseJWT(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  return { header, payload, signature: parts[2], raw: parts };
}

async function importPublicKey(pemKey) {
  // Strip PEM headers
  const pemContents = pemKey
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '');

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Import as X.509 certificate then extract public key
  const cert = await crypto.subtle.importKey(
    'raw',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return cert;
}

export async function verifyFirebaseToken(token, env) {
  try {
    const projectId = env.FIREBASE_PROJECT_ID;
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID not set');

    const { header, payload, raw } = parseJWT(token);

    // Basic claims validation
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) throw new Error('Token expired');
    if (payload.iat > now + 300) throw new Error('Token issued in the future');
    if (payload.aud !== projectId) throw new Error('Invalid audience');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error('Invalid issuer');
    }
    if (!payload.sub || payload.sub.length === 0) throw new Error('No subject');

    // Verify signature
    const keys = await getFirebasePublicKeys();
    const pemKey = keys[header.kid];
    if (!pemKey) throw new Error('Unknown key ID');

    const publicKey = await importPublicKey(pemKey);
    const signedData = new TextEncoder().encode(`${raw[0]}.${raw[1]}`);
    const signatureBytes = base64UrlDecode(raw[2]);

    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signatureBytes,
      signedData
    );

    if (!isValid) throw new Error('Invalid signature');

    // Return the user ID (uid)
    return payload.sub;

  } catch (err) {
    console.error('Token verification failed:', err.message);
    return null;
  }
}
