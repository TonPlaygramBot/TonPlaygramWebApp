import { post } from './api.js';
import { rewardIdentity } from './rewardIdentity.js';

// Operation ids are retry hints, never identity, eligibility or reward authority.
const keyFor = (kind) => `server-spin-request:${rewardIdentity()}:${kind}`;
const legacyRetry = (kind, key) => {
  // #26088 used the first available identity hint. Keep that key intact: another
  // sign-in may still need it. Only copy a UUID once per full current identity.
  const legacyOwner = localStorage.getItem('accountId') || localStorage.getItem('googleId') || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'signed-in';
  const id = localStorage.getItem(`server-spin-request:${legacyOwner}:${kind}`);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id || '') &&
    localStorage.getItem(`${key}:legacy-recovered`) !== id ? id : null;
};
const checked = async (promise) => {
  const result = await promise;
  if (!result || result.error) throw new Error(result?.error || 'Could not confirm the reward. Please retry.');
  return result;
};
export function hasPendingServerSpin(kind) { const key = keyFor(kind); return Boolean(localStorage.getItem(key) || legacyRetry(kind, key)); }
export function spinRewardStatus(kind) {
  return checked(post('/api/spin-rewards/status', { kind }));
}
export async function startServerSpin(kind) {
  const key = keyFor(kind);
  let requestId = localStorage.getItem(key);
  const legacyId = legacyRetry(kind, key);
  if (!requestId) {
    requestId = legacyId || crypto.randomUUID();
    localStorage.setItem(key, requestId);
  }
  // A newer scoped operation also supersedes this old retry hint.
  if (legacyId) localStorage.setItem(`${key}:legacy-recovered`, legacyId);
  const grant = await checked(post('/api/spin-rewards/start', { kind, requestId }));
  // Another device may already have reserved a grant. Retain its actual ID for
  // recovery if a later claim response is lost. Do not overwrite a newer tab.
  if (grant.id && localStorage.getItem(key) === requestId) localStorage.setItem(key, grant.id);
  return grant;
}
export async function claimServerSpin(kind, id) {
  const key = keyFor(kind);
  const owner = rewardIdentity();
  const requestId = localStorage.getItem(key);
  const result = await checked(post('/api/spin-rewards/claim', { kind, id }));
  if (result.claimed !== true) throw new Error('Reward was not confirmed. Please retry.');
  if (localStorage.getItem(key) === requestId) localStorage.removeItem(key);
  if (owner === rewardIdentity()) {
    window.dispatchEvent(new CustomEvent('walletBalanceUpdated', { detail: { balance: result.balance } }));
    if (kind === 'lucky' && result.outcome === 'FREE_SPIN') {
      window.dispatchEvent(new Event('serverSpinRewardsUpdated'));
    }
  }
  return result;
}
