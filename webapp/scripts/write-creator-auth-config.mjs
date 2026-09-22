import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

export async function writeCreatorAuthConfig(projectRoot) {
  const env = loadEnv('production', projectRoot, 'VITE_');
  const value = process.env.CREATOR_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID || '';
  const googleClientId = /^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(value.trim()) ? value.trim() : '';
  const destination = path.join(projectRoot, 'public', 'creator-auth-config.json');
  // The OAuth client ID is public. Never serialize the full env or a secret.
  await writeFile(destination, JSON.stringify({ googleClientId }) + '\n');
  return destination;
}
