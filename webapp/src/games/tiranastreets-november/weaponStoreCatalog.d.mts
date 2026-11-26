export type WeaponStoreItem = Readonly<{
  id: string; weaponId: string; displayName: string; priceTPG: number;
  modelUrl: string; model: string; category: string; available: boolean;
}>;
export const WEAPON_STORE_CATALOG: readonly WeaponStoreItem[];
export const WEAPON_STORE_BY_ID: ReadonlyMap<string, WeaponStoreItem>;
