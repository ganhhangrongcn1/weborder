// Compare only keys provisioned by Supabase; never authorize using JWT payload claims.
export function isAnalyServerRequest(headers, legacyKey, namedKeysJson = '{}') {
  const bearer = headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (legacyKey && bearer === legacyKey) return true;
  const key = headers.get('apikey');
  if (!key?.startsWith('sb_secret_')) return false;
  try {
    const keys = JSON.parse(namedKeysJson);
    return !!keys && typeof keys === 'object' && !Array.isArray(keys)
      && Object.values(keys).some(value => typeof value === 'string' && value === key);
  } catch { return false; }
}

// Optional CLI-provisioned service-key fingerprint; the key itself is never stored here.
export async function isAnalyFingerprintRequest(headers, expectedHash = '') {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const key = headers.get('x-analy-server-key');
  if (!key || key.length > 4096) return false;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const actual = Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  return actual === expectedHash;
}
