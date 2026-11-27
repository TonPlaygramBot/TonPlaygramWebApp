import {get} from '../../utils/api.js';

export class PlatformBalanceChanged extends Error {}
const accountSession = () => [
  window.localStorage.getItem('accountId'),
  window.localStorage.getItem('googleId'),
  (window as Window & {Telegram?:{WebApp?:{initDataUnsafe?:{user?:{id?:number}}}}}).Telegram?.WebApp?.initDataUnsafe?.user?.id
].join('|');

/** Display only, using the signed Telegram/Google session on the server. */
export async function loadPlatformTpgBalance(): Promise<number> {
  const session = accountSession();
  const response = await get('/api/account/self-tpg-balance');
  if (session !== accountSession()) throw new PlatformBalanceChanged();
  const balance = response?.balance;
  if (response?.error || typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) {
    throw new Error('TonPlayGram balance is unavailable. Sign in again or open Wallet.');
  }
  return balance;
}

export type WeaponStoreAccount = { balanceTPG: number; ownedWeaponIds: string[] };

const unavailable = () => new Error('TPG purchases are unavailable. Local street cash still works for ammunition, healing and armor.');
export async function loadWeaponStoreAccount(): Promise<WeaponStoreAccount> { throw unavailable(); }
export async function purchaseWeapon(_itemId: string, _idempotencyKey?: string): Promise<WeaponStoreAccount> { throw unavailable(); }
