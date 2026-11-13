/** Revised high-detail review masters, not the V1 crowd LOD set.
 * This catalog is deliberately opt-in. It does not activate a game mode.
 */
export const CITYLIFE_V2_BASE = '/assets/tirana-citylife/v2/';
export const CITYLIFE_V2_IDS = Object.freeze([
  'albanian_ambulance', 'albanian_fire_engine',
  'paramedic_red', 'paramedic_navy', 'firefighter_rescue', 'firefighter_operator',
  'civilian_student', 'civilian_worker', 'civilian_courier', 'civilian_business', 'civilian_local'
]);
export const CITYLIFE_V2_REVIEW_ONLY = true;
export const CITYLIFE_V2_HAS_LODS = false;
const ids = new Set(CITYLIFE_V2_IDS);
export function cityLifeV2AssetUrl(id) {
  if (!ids.has(id)) throw new RangeError('Unknown revised CityLife asset: ' + String(id));
  return CITYLIFE_V2_BASE + id + '.glb';
}
