import { post } from './api.js';

// Operation ids are retry hints, never identity, eligibility or reward authority.
const keyFor = (kind) => `server-spin-request:${localStorage.getItem('accountId') || localStorage.getItem('googleId') || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'signed-in'}:${kind}`;
const checked = async (promise) => {
  const result = await promise;
  if (!result || result.error) throw new Error(result?.error || 'Could not confirm the reward. Please retry.');
  return result;
};
export function hasPendingServerSpin(kind) { return Boolean(localStorage.getItem(keyFor(kind))); }
export function spinRewardStatus(kind) {
  return checked(post('/api/spin-rewards/status', { kind }));
}
export async function startServerSpin(kind) {
  const key = keyFor(kind);
  let requestId = localStorage.getItem(key);
  if (!requestId) {
    requestId = crypto.randomUUID();
    localStorage.setItem(key, requestId);
  }
  const grant = await checked(post('/api/spin-rewards/start', { kind, requestId }));
  // Another device may already have reserved a grant. Retain its actual ID for
  // recovery if a later claim response is lost. Do not overwrite a newer tab.
  if (grant.id && localStorage.getItem(key) === requestId) localStorage.setItem(key, grant.id);
  return grant;
}
export async function claimServerSpin(kind, id) {
  const key = keyFor(kind);
  const requestId = localStorage.getItem(key);
  const result = await checked(post('/api/spin-rewards/claim', { kind, id }));
  if (result.claimed !== true) throw new Error('Reward was not confirmed. Please retry.');
  if (localStorage.getItem(key) === requestId) localStorage.removeItem(key);
  if (key === keyFor(kind)) window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { balance: result.balance } }));
  return result;
}
