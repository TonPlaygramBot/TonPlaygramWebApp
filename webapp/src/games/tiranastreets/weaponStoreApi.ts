import { ensureAccountId } from '../../utils/telegram.js';

export type WeaponStoreAccount = { balanceTPG: number; ownedWeaponIds: string[] };

async function request(path: string, init?: RequestInit) {
  const accountId = await ensureAccountId();
  if (!accountId) throw Error('Sign in to your TPG account before purchasing.');
  const telegramInitData = window.Telegram?.WebApp?.initData || '';
  const response = await fetch(`/api/tirana-store${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-tpc-account-id': accountId,
      ...(telegramInitData ? { 'x-telegram-init-data': telegramInitData } : {}),
      ...init?.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(body.error || 'Purchase failed.'), { code: body.code });
  return body;
}

export const loadWeaponStoreAccount = () => request('/account') as Promise<WeaponStoreAccount>;

export const purchaseWeapon = (itemId: string, idempotencyKey: string) =>
  request('/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemId, idempotencyKey })
  }) as Promise<WeaponStoreAccount & { weaponId: string; transactionId: string }>;
