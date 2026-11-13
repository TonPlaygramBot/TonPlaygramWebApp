import crypto from 'node:crypto';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

function configuredAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
}

// A factory keeps key caching local and permits deterministic signature tests.
// The remote URL is fixed; a token cannot supply its own key server or algorithm.
export function createGoogleTokenVerifier({ fetchImpl = globalThis.fetch, audiences = configuredAudiences, now = Date.now } = {}) {
  let keys = [];
  let keysExpireAt = 0;
  let pendingKeys;
  let lastFetchAt = -Infinity;

  async function loadKeys(force = false) {
    const time = now();
    if (!force && time < keysExpireAt && keys.length) return keys;
    if (pendingKeys) return pendingKeys;
    // Unknown key ids must not turn arbitrary invalid tokens into unlimited
    // outbound requests. A legitimate rotation retries after this short bound.
    if (time - lastFetchAt < 30_000) {
      if (time < keysExpireAt) return keys;
      throw new Error('Google verification keys temporarily unavailable');
    }
    lastFetchAt = time;
    pendingKeys = (async () => {
      const response = await fetchImpl(GOOGLE_JWKS_URL, {
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('Google verification keys unavailable');
      const body = await response.json();
      if (!Array.isArray(body.keys) || !body.keys.length || body.keys.length > 20) throw new Error('Invalid Google verification keys');
      const nextKeys = body.keys.filter((key) => key.kty === 'RSA' && key.use === 'sig' && key.alg === 'RS256' && typeof key.kid === 'string');
      if (!nextKeys.length) throw new Error('Invalid Google verification keys');
      const maxAge = Number(response.headers.get('cache-control')?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] || 300);
      keys = nextKeys;
      keysExpireAt = now() + Math.min(Math.max(maxAge, 0), 3600) * 1000;
      return keys;
    })();
    try { return await pendingKeys; } finally { pendingKeys = undefined; }
  }

  return async function verifyGoogleIdToken(credential) {
    try {
      const allowedAudiences = typeof audiences === 'function' ? audiences() : audiences;
      if (!Array.isArray(allowedAudiences) || !allowedAudiences.length || typeof credential !== 'string' || credential.length > 16384) return null;
      const parts = credential.split('.');
      if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      const nowSeconds = Math.floor(now() / 1000);
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit !== undefined) return null;
      if (!GOOGLE_ISSUERS.has(claims.iss) || typeof claims.aud !== 'string' || !allowedAudiences.includes(claims.aud)) return null;
      if (claims.azp !== undefined && !allowedAudiences.includes(claims.azp)) return null;
      if (!Number.isSafeInteger(claims.exp) || claims.exp <= nowSeconds || !Number.isSafeInteger(claims.iat) || claims.iat > nowSeconds + 60 || claims.exp <= claims.iat) return null;
      if (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds)) return null;
      if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) return null;
      let candidates = await loadKeys();
      let key = candidates.find((entry) => entry.kid === header.kid);
      if (!key) {
        candidates = await loadKeys(true);
        key = candidates.find((entry) => entry.kid === header.kid);
      }
      if (!key || !crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`),
        crypto.createPublicKey({ key, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) return null;
      return {
        googleId: claims.sub,
        email: claims.email_verified === true && typeof claims.email === 'string' ? claims.email : '',
        firstName: typeof claims.given_name === 'string' ? claims.given_name : '',
        lastName: typeof claims.family_name === 'string' ? claims.family_name : '',
        photo: typeof claims.picture === 'string' ? claims.picture : ''
      };
    } catch {
      // Signature, network and configuration failures all fail closed.
      return null;
    }
  };
}

export const verifyGoogleIdToken = createGoogleTokenVerifier();
