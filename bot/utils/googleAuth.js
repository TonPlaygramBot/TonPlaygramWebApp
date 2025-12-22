import { OAuth2Client } from 'google-auth-library';
import { sanitizeText, sanitizeUrl } from './sanitize.js';

const allowedIssuers = ['https://accounts.google.com', 'accounts.google.com'];

function getClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  return new OAuth2Client(clientId, clientSecret);
}

async function verifyGoogleIdToken(idToken) {
  if (!idToken) return null;
  if (process.env.GOOGLE_SKIP_SIGNATURE === 'true') {
    const payload = decodeJwt(idToken);
    if (!payload) return null;
    return validatePayload(payload);
  }

  const client = getClient();
  const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  return validatePayload(payload);
}

async function exchangeGoogleCode(code, redirectUri) {
  const client = getClient();
  if (redirectUri) {
    client.redirectUri = redirectUri;
  }
  const { tokens } = await client.getToken(code);
  return tokens;
}

function validatePayload(payload) {
  if (!payload) return null;
  const { aud, iss, sub, email, name, picture } = payload;
  if (process.env.GOOGLE_CLIENT_ID && aud !== process.env.GOOGLE_CLIENT_ID) return null;
  if (!allowedIssuers.includes(iss)) return null;
  return {
    googleId: sub,
    email: email || '',
    name: sanitizeText(name || ''),
    picture: sanitizeUrl(picture || '')
  };
}

function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    const parsed = Buffer.from(payload, 'base64url').toString('utf8');
    return JSON.parse(parsed);
  } catch {
    return null;
  }
}

export { verifyGoogleIdToken, exchangeGoogleCode };
