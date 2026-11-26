export type WeaponStoreAccount = { balanceTPG: number; ownedWeaponIds: string[] };

const unavailable = () => new Error('TPG purchases are unavailable. Local street cash still works for ammunition, healing and armor.');
export async function loadWeaponStoreAccount(): Promise<WeaponStoreAccount> { throw unavailable(); }
export async function purchaseWeapon(_itemId: string, _idempotencyKey?: string): Promise<WeaponStoreAccount> { throw unavailable(); }
