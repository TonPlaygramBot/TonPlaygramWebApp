import crypto from 'node:crypto';

const pendingAuthorizations = new Map();
const MAX_STATE_AGE_MS = 10 * 60 * 1000;

export const SOCIAL_OAUTH_PROVIDERS = {
  tiktok: {
    authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    profileUrl: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    scopes: ['user.info.basic', 'video.publish', 'video.upload'],
    clientIdParam: 'client_key'
  },
  instagram: {
    authorizeUrl: 'https://www.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    profileUrl: 'https://graph.instagram.com/me?fields=id,username',
    scopes: ['instagram_business_basic', 'instagram_business_content_publish']
  },
  facebook: {
    authorizeUrl: 'https://www.facebook.com/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/oauth/access_token',
    profileUrl: 'https://graph.facebook.com/me?fields=id,name',
    scopes: ['public_profile', 'pages_show_list', 'pages_manage_posts']
  },
  youtube: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    profileUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scopes: ['openid', 'profile', 'https://www.googleapis.com/auth/youtube.upload'],
    extraAuthorizeParams: { access_type: 'offline', prompt: 'consent' }
  },
  x: {
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    profileUrl: 'https://api.x.com/2/users/me',
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    pkce: true
  },
  telegram: {
    authorizeUrl: 'https://oauth.telegram.org/auth',
    tokenUrl: 'https://oauth.telegram.org/token',
    profileUrl: 'https://oauth.telegram.org/userinfo',
    scopes: ['openid', 'profile'],
    pkce: true
  },
  discord: {
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/v10/oauth2/token',
    profileUrl: 'https://discord.com/api/v10/users/@me',
    scopes: ['identify', 'webhook.incoming']
  }
};

const base64url = (value) => Buffer.from(value).toString('base64url');
const envPrefix = (platform) => `SOCIAL_${platform.toUpperCase()}`;

function oauthSecret(env) {
  return env.SOCIAL_OAUTH_STATE_SECRET || env.API_TOKEN || env.JWT_SECRET || '';
}

function signState(payload, env) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', oauthSecret(env)).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(state, env) {
  const [encoded, supplied] = String(state || '').split('.');
  if (!encoded || !supplied || !oauthSecret(env)) throw new Error('Invalid OAuth state');
  const expected = crypto.createHmac('sha256', oauthSecret(env)).update(encoded).digest();
  const received = Buffer.from(supplied, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw new Error('Invalid OAuth state');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
  if (!payload.issuedAt || Date.now() - payload.issuedAt > MAX_STATE_AGE_MS) throw new Error('OAuth state expired');
  return payload;
}

export function oauthConfiguration(platform, env = process.env) {
  const provider = SOCIAL_OAUTH_PROVIDERS[platform];
  if (!provider) return null;
  const prefix = envPrefix(platform);
  return {
    ...provider,
    clientId: String(env[`${prefix}_CLIENT_ID`] || '').trim(),
    clientSecret: String(env[`${prefix}_CLIENT_SECRET`] || '').trim(),
    redirectUri: String(env[`${prefix}_REDIRECT_URI`] || '').trim()
  };
}

export function createAuthorization(platform, ownerId, env = process.env) {
  const config = oauthConfiguration(platform, env);
  if (!config) throw new Error('Unsupported social platform');
  const missing = ['clientId', 'clientSecret', 'redirectUri'].filter((key) => !config[key]);
  if (!oauthSecret(env)) missing.push('state secret');
  if (missing.length) throw new Error(`${platform} OAuth is not configured (${missing.join(', ')})`);

  const nonce = crypto.randomBytes(24).toString('base64url');
  const verifier = config.pkce ? crypto.randomBytes(48).toString('base64url') : '';
  const state = signState({ platform, ownerId, nonce, issuedAt: Date.now() }, env);
  pendingAuthorizations.set(nonce, { verifier, expiresAt: Date.now() + MAX_STATE_AGE_MS });
  const params = new URLSearchParams({
    response_type: 'code',
    [config.clientIdParam || 'client_id']: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(' '),
    state,
    ...config.extraAuthorizeParams
  });
  if (verifier) {
    params.set('code_challenge', crypto.createHash('sha256').update(verifier).digest('base64url'));
    params.set('code_challenge_method', 'S256');
  }
  return { authorizationUrl: `${config.authorizeUrl}?${params}`, state };
}

export async function completeAuthorization(platform, query, env = process.env, fetchImpl = fetch) {
  const state = verifyState(query.state, env);
  if (state.platform !== platform) throw new Error('OAuth provider mismatch');
  const pending = pendingAuthorizations.get(state.nonce);
  pendingAuthorizations.delete(state.nonce);
  if (!pending || pending.expiresAt < Date.now()) throw new Error('OAuth session expired; please connect again');
  if (query.error) throw new Error(String(query.error_description || query.error));
  if (!query.code) throw new Error('Authorization code was not returned');

  const config = oauthConfiguration(platform, env);
  const body = new URLSearchParams({ code: String(query.code), grant_type: 'authorization_code', redirect_uri: config.redirectUri, client_id: config.clientId, client_secret: config.clientSecret });
  if (platform === 'tiktok') { body.delete('client_id'); body.set('client_key', config.clientId); }
  if (pending.verifier) body.set('code_verifier', pending.verifier);
  const tokenResponse = await fetchImpl(config.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error_description || tokens.message || tokens.error || 'Token exchange failed');

  const separator = config.profileUrl.includes('?') ? '&' : '?';
  const profileResponse = await fetchImpl(`${config.profileUrl}${separator}access_token=${encodeURIComponent(tokens.access_token)}`, { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' } });
  const profile = await profileResponse.json();
  if (!profileResponse.ok) throw new Error(profile.error?.message || profile.message || 'Could not load social profile');
  const user = profile.data?.user || profile.data || profile;
  const accountName = user.username || user.display_name || user.name || user.global_name || user.email || user.id || user.open_id;
  if (!accountName) throw new Error('The provider did not return an account identity');
  return { ownerId: state.ownerId, accountName: String(accountName), tokens };
}

export function encryptCredentials(credentials, env = process.env) {
  const secret = String(env.SOCIAL_CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!secret) throw new Error('SOCIAL_CREDENTIALS_ENCRYPTION_KEY is not configured');
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials)), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function oauthReturnUrl(platform, status, message, env = process.env) {
  const base = String(env.SOCIAL_OAUTH_APP_RETURN_URL || '/admin/social').trim();
  const url = new URL(base, env.PUBLIC_APP_URL || 'http://localhost');
  url.searchParams.set('socialTab', 'accounts');
  url.searchParams.set('oauthPlatform', platform);
  url.searchParams.set('oauthStatus', status);
  if (message) url.searchParams.set('oauthMessage', message);
  return base.startsWith('/') && !env.PUBLIC_APP_URL ? `${url.pathname}${url.search}` : url.toString();
}
