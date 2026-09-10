/** Authoritative Tirana Streets catalog. The bot imports this exact module so
 * display models, prices and delivery ids cannot drift between client/server. */
export const WEAPON_STORE_CATALOG = Object.freeze([
  ['glockSidearmAttack', 'Glock Sidearm', 850, 'sigsauer', 'sidearm'],
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
  modelUrl: `/assets/tirana-streets/living/${model}.glb`,
  model,
  category,
  available: true
})));

export const WEAPON_STORE_BY_ID = new Map(
  WEAPON_STORE_CATALOG.map((item) => [item.id, item])
);
