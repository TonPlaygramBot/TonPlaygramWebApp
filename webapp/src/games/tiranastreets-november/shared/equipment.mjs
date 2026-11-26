import {WEAPON_BY_ID} from './weapons.mjs';
import {WEAPON_OPTICS} from './weaponCalibration.mjs';
export const armorCapacity=player=>player?.inventory?.armorCarrier?150:100;
export function equipmentZoom(player){
 const weapon=WEAPON_BY_ID.get(player?.weapon),native=WEAPON_OPTICS[player?.weapon]?.zoom||1;
 return player?.inventory?.scope4x&&['rifle','marksman','smg'].includes(weapon?.category)?Math.max(4,native):native;
}
