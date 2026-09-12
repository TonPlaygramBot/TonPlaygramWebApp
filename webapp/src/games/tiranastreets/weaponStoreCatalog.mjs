import {IMPORTED_BY_ID} from './shared/importedAssets.mjs';
import {WEAPON_BY_ID} from './shared/weapons.mjs';
/** Authoritative Tirana Streets catalog. The bot imports this exact module so
 * display models, prices and delivery ids cannot drift between client/server. */
export const WEAPON_STORE_CATALOG = Object.freeze([
  ['glockSidearmAttack', 'Glock Sidearm', 0, 'glockSidearmAttack', 'sidearm'],
  ['uziSprayAttack', 'Uzi Spray', 1750, 'uzi', 'smg'],
  ['ak47VolleyAttack', 'AK-47 Volley', 2500, 'ak47', 'rifle'],
  ['krsvBurstAttack', 'KRSV Burst', 2850, 'krsv', 'rifle'],
  ['shotgunBlastAttack', 'Tactical Shotgun', 2200, 'shotgun', 'shotgun'],
  ['mosinMarksmanAttack', 'Mosin Marksman', 3400, 'mosin', 'marksman'],
  ['grenadeBlastAttack', 'Grenade Launcher', 4800, 'grenade', 'launcher']
].map(([weaponId, displayName, priceTPG, model, category]) => Object.freeze({
  id: `tirana-${weaponId}`,
  weaponId,
  displayName,
  priceTPG,
  modelUrl: IMPORTED_BY_ID.get(WEAPON_BY_ID.get(weaponId)?.model)?.localUrl || `/assets/tirana-streets/living/${model}.glb`,
  model: WEAPON_BY_ID.get(weaponId)?.model || model,
  category,
  available: true
})));

export const WEAPON_STORE_BY_ID = new Map(
  WEAPON_STORE_CATALOG.map((item) => [item.id, item])
);
