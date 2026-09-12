import { ensureAccountId } from '../../utils/telegram.js';
import { API_BASE_URL } from '../../utils/api.js';
import { getNativeBridgeHeaders } from '../../utils/nativeBridge';

export type WeaponStoreAccount = { balanceTPG: number; ownedWeaponIds: string[] };

async function request(path: string, init?: RequestInit, purchaseAccount?: string) {
  const accountId = purchaseAccount || await ensureAccountId();
  if (!accountId) throw Error('Sign in to your TPG account before purchasing.');
  const telegramInitData = window.Telegram?.WebApp?.initData || '';
  const abort = new AbortController(), timer = setTimeout(()=>abort.abort(),15000);
  try {
  const response = await fetch(`${API_BASE_URL}/api/tirana-store${path}`, {
    signal:abort.signal,
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-tpc-account-id': accountId,
      ...getNativeBridgeHeaders(),
      ...(telegramInitData ? { 'x-telegram-init-data': telegramInitData } : {}),
      ...init?.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(body.error || 'Purchase failed.'), { code: body.code, status:response.status });
  return body;
  } finally { clearTimeout(timer); }
}

export const loadWeaponStoreAccount = () => request('/account') as Promise<WeaponStoreAccount>;

const pendingKeys = new Map<string,string>();
export async function purchaseWeapon(itemId: string, idempotencyKey?: string) {
  const accountId = await ensureAccountId();
  if (!accountId) throw Error('Sign in to your TPG account before purchasing.');
  const storageKey = `tirana-purchase:${accountId}:${itemId}`;
  let key = pendingKeys.get(storageKey);
  try { key ||= localStorage.getItem(storageKey) || undefined; } catch { /* memory fallback */ }
  key ||= idempotencyKey || crypto.randomUUID();
  pendingKeys.set(storageKey,key);
  try { localStorage.setItem(storageKey,key); } catch { /* memory fallback */ }
  try {
    const receipt = await request('/purchase', {
    method: 'POST',
      body: JSON.stringify({ itemId, idempotencyKey:key })
    },accountId) as WeaponStoreAccount & { weaponId: string; transactionId: string };
    pendingKeys.delete(storageKey);
    try { localStorage.removeItem(storageKey); } catch { /* no persistence */ }
    return receipt;
  } catch(error) {
    // A lost response keeps its reference across retries/reloads. A definite
    // rejection can start a new purchase after funds or account state changes.
    if ([400,401,402,403,404,409].includes((error as {status:number}).status)) {
      pendingKeys.delete(storageKey);
      try { localStorage.removeItem(storageKey); } catch { /* no persistence */ }
    }
    throw error;
  }
}
