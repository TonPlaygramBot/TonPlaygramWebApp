import { problem } from './security.js';
export async function request(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, redirect: 'error', signal: options.signal || AbortSignal.timeout(25000) }); }
  catch { throw problem(502, 'The platform did not confirm the request. Check its activity before trying again.'); }
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok || data.error?.code && data.error.code !== 'ok') {
    const auth = response.status === 401 || [190, 'access_token_invalid'].includes(data.error?.code);
    throw problem(auth ? 401 : 502, auth ? 'Please reconnect this account.' : `The platform could not complete this request (${response.status}). Check account permissions and try again.`);
  }
  return data;
}
export const json = (method, token, body, extra = {}) => ({ method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
export const form = body => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(Object.entries(body).filter(([,v]) => v !== undefined)) });
export const metaVersion = () => process.env.CREATOR_META_VERSION || 'v25.0';
export const fb = () => `https://graph.facebook.com/${metaVersion()}`;
