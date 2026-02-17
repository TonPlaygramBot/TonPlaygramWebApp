import { env } from '../env.js';

export type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: string;
  aud: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<{ sub: string; email?: string }> {
  const url = new URL('https://oauth2.googleapis.com/tokeninfo');
  url.searchParams.set('id_token', idToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Invalid Google id_token');
  const profile = (await res.json()) as GoogleProfile;

  if (env.googleClientId && profile.aud !== env.googleClientId) {
    throw new Error('Google token audience mismatch');
  }

  return { sub: profile.sub, email: profile.email };
}
