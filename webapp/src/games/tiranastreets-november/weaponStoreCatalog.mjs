import {IMPORTED_BY_ID} from './shared/importedAssets.mjs';
import {WEAPON_BY_ID} from './shared/weapons.mjs';
import {UPLOADED_WEAPONS} from './shared/uploadedWeapons.mjs';
/** Authoritative Tirana Streets catalog. The bot imports this exact module so
 * display models, prices and delivery ids cannot drift between client/server. */
export const WEAPON_STORE_CATALOG = Object.freeze([
  ...UPLOADED_WEAPONS.map(w=>[w.id,w.label,w.priceTPG,w.model,w.category]),
  ['glockSidearmAttack', 'Glock Sidearm', 0, 'glockSidearmAttack', 'sidearm'],
  ['uziSprayAttack', 'Uzi Spray', 1750, 'uzi', 'smg'],
  ['ak47VolleyAttack', 'AK-47 Volley', 2500, 'ak47', 'rifle'],
  ['krsvBurstAttack', 'KRSV Burst', 2850, 'krsv', 'rifle'],
  ['shotgunBlastAttack', 'Tactical Shotgun', 2200, 'shotgun', 'shotgun'],
  ['mosinMarksmanAttack', 'Mosin Marksman', 3400, 'mosin', 'marksman'],
  ['grenadeBlastAttack', 'Grenade Launcher', 4800, 'grenade', 'launcher'],
  ['sigsauerTacticalAttack', 'SigSauer Tactical', 1450, 'sigsauer', 'sidearm'],
  ['smithSidearmAttack', 'Smith Sidearm', 1600, 'smith', 'sidearm'],
  ['awpSniperAttack', 'AWP Sniper', 4200, 'awpSniperAttack', 'marksman'],
  ['mrtkGunAttack', 'MRTK Rifle', 3100, 'mrtkGunAttack', 'rifle'],
  ['polyBazooka01Attack', 'Bazooka', 5300, 'polyBazooka01Attack', 'launcher'],
  ['polyHandGrenade01Attack', 'Hand Grenade', 3600, 'polyHandGrenade01Attack', 'launcher'],
  ['polyMolotov01Attack', 'Molotov', 2900, 'polyMolotov01Attack', 'launcher'],
  ['c4Charge', 'C4 Remote Charge', 4600, 'polyDynamiteBomb01Attack', 'explosive'],
  ['shahedDrone', 'Shahed-style Arcade Drone', 6500, 'drone', 'drone'],
  ['scope4x', '4× Universal Scope', 1800, '', 'equipment'],
  ['armorCarrier', 'Heavy Body Armor Carrier', 2100, '', 'equipment']
].map(([weaponId, displayName, priceTPG, model, category]) => Object.freeze({
  id: `tirana-${weaponId}`,
  weaponId,
  displayName,
  priceTPG,
  modelUrl: category==='equipment' ? '' : weaponId==='shahedDrone' ? '/assets/ludo/presentation/drone.glb' : UPLOADED_WEAPONS.find(w=>w.id===weaponId)?.modelUrl || IMPORTED_BY_ID.get(WEAPON_BY_ID.get(weaponId)?.model)?.localUrl || `/assets/tirana-streets/living/${({polyBazooka01Attack:'launcher',polyHandGrenade01Attack:'grenade',polyMolotov01Attack:'grenade',polyDynamiteBomb01Attack:'grenade'})[model]||model}.glb`,
  model: WEAPON_BY_ID.get(weaponId)?.model || model,
  category,
  available: true
})));

export const WEAPON_STORE_BY_ID = new Map(
  WEAPON_STORE_CATALOG.map((item) => [item.id, item])
);
