import {WEAPON_BY_ID, STARTER_WEAPON} from './shared/weapons.mjs';
import {UPLOADED_WEAPONS} from './shared/uploadedWeapons.mjs';

export const STARTING_WEAPON_CHOICES = Object.freeze([
  ...UPLOADED_WEAPONS.map(w=>w.id), 'ak47VolleyAttack', 'uziSprayAttack', 'mosinMarksmanAttack'
]);
export const DEFAULT_LOADOUT = Object.freeze(['adaptiveCombatRifleAttack','vityazAttack','makarovAttack']);
const allowed = new Set(STARTING_WEAPON_CHOICES);
let selected = null;
export function validStartingLoadout(ids) {
  return Array.isArray(ids) && ids.length===3 && new Set(ids).size===3 && ids.every(id=>allowed.has(id));
}
export function selectStartingLoadout(ids) {
  if(!validStartingLoadout(ids)) throw Error('Choose exactly three different weapons.');
  selected=Object.freeze([...ids]);
}
export function selectedStartingLoadout() { return selected; }
/** Local run equipment only. This never grants TPG account ownership or refills
 * existing ammunition. Purchased equipment and saved progress are preserved. */
export function applyStartingLoadout(player, ids=selected, fresh=false) {
  if(!validStartingLoadout(ids))return false;
  player.inventory ||= {};
  if(fresh && !ids.includes(STARTER_WEAPON))delete player.inventory[STARTER_WEAPON];
  for(const id of ids){const w=WEAPON_BY_ID.get(id);player.inventory[id] ||= {ammo:w.magazine,reserve:w.magazine*3};}
  player.weapon=ids[0];
  player.reloadAt=0;
  return true;
}
