import { readFileSync } from 'node:fs';
import { OAuth2Client } from 'google-auth-library';
import { OAuth } from './models.js';
import { configured, cookies, digest, issueSession, problem, random, setCookie } from './security.js';

const verifier = new OAuth2Client({ transporterOptions: { timeout: 10000 } });
let buildClientId;
const validClientId = value => typeof value === 'string' && /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value.trim()) ? value.trim() : '';
export function googleClientId() {
  const explicit = process.env.CREATOR_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  if (explicit) return validClientId(explicit);
  if (buildClientId === undefined) {
    try { buildClientId = validClientId(JSON.parse(readFileSync(new URL('../../webapp/dist/creator-auth-config.json', import.meta.url), 'utf8')).googleClientId); }
    catch { buildClientId = ''; }
  }
  return buildClientId;
}
export function googleSignInStatus() {
  if (!configured()) return { available: false, reason: 'secure_storage' };
  if (!googleClientId()) return { available: false, reason: 'client_id' };
  return { available: true, reason: null };
}
export async function beginGoogleSignIn(_req, res) {
  const status = googleSignInStatus();
  if (!status.available) throw problem(503, 'Google sign-in is not configured for TonPlayGram yet. Please contact support.');
  const nonce = random(), binding = random();
  await OAuth.create({ stateHash: digest(nonce), binding: digest(binding), platform: 'google-identity', expiresAt: new Date(Date.now() + 600000) });
  setCookie(res, 'tpg_creator_google', binding, 600000);
  return { clientId: googleClientId(), nonce };
}
export async function verifyGoogleCredential(credential) {
  const audience = googleClientId();
  if (!audience || typeof credential !== 'string' || credential.length > 16000) throw problem(401, 'Google could not verify this sign-in. Please try again.');
  try {
    // Google Auth Library verifies the signature, audience, issuer and lifetime,
    // and caches Google's rotating public certificates. No decoded-only login.
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience });
    const profile = ticket.getPayload();
    if (!profile?.sub || !/^[a-zA-Z0-9_-]{1,255}$/.test(profile.sub) || typeof profile.nonce !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(profile.nonce) || Number(profile.exp) <= Date.now() / 1000) throw new Error('Invalid Google identity');
    return profile;
  } catch { throw problem(401, 'Google could not verify this sign-in. Please try again.'); }
}
export async function finishGoogleSignIn(req, res) {
  const binding = cookies(req).tpg_creator_google;
  if (!binding) throw problem(401, 'Google sign-in expired. Please try again.');
  const profile = await verifyGoogleCredential(req.body?.credential);
  const pending = await OAuth.findOneAndDelete({ stateHash: digest(profile.nonce), binding: digest(binding), platform: 'google-identity', expiresAt: { $gt: new Date() } });
  if (!pending) throw problem(401, 'Google sign-in expired. Please try again.');
  setCookie(res, 'tpg_creator_google', '', 0);
  issueSession(res, `google:${profile.sub}`, profile.name);
  return { signedIn: true, name: profile.name || 'Creator', method: 'google' };
}
