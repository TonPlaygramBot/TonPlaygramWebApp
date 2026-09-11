/** Local Albanian Forces v2 assets. Simulation roles/physics stay independent
 * of the presentation model, and explicit IDs survive multiplayer snapshots. */
const BASE = '/assets/tirana-streets/albanian-forces/';
export const FORCE_ASSETS = Object.freeze([
  ['patrol_hatch', 'Patrullë · Focus', 'vehicle', .33],
  ['patrol_sedan', 'Patrullë · Impreza', 'vehicle', .33],
  ['shqiponja_compact', 'Shqiponja · kompakte', 'vehicle', .33],
  ['police_van', 'Policia · Sprinter', 'vehicle', .375],
  ['fnsh_armored_van', 'FNSH · Sprinter', 'vehicle', .375],
  ['renea_armored_van', 'RENEA · mjeti i blinduar', 'vehicle', .51],
  ['traffic_bike', 'Motori rrugor', 'vehicle', .33],
  ['shqiponja_bike', 'Motori Shqiponja', 'vehicle', .33],
  ['patrol_officer', 'Oficeri i patrullës', 'person', 0],
  ['traffic_officer', 'Oficeri rrugor', 'person', 0],
  ['shqiponja_officer', 'Oficeri Shqiponja', 'person', 0],
  ['fnsh_officer', 'Oficeri FNSH', 'person', 0],
  ['renea_officer', 'Operatori RENEA', 'person', 0],
  ['army_soldier', 'Ushtari', 'person', 0],
].map(([id, label, category, wheelRadius]) => Object.freeze({
  id, label, category, wheelRadius, url: `${BASE}glb/${id}.glb?v=original-v2`,
})));
export const FORCE_ASSET_BY_ID = new Map(FORCE_ASSETS.map(a => [a.id, a]));
const PATROL = [
  ['patrol_hatch', 'patrol_officer'], ['traffic_bike', 'traffic_officer'],
  ['patrol_sedan', 'patrol_officer'], ['police_van', 'patrol_officer'],
];
const SHQIPONJA = [
  ['shqiponja_compact', 'shqiponja_officer'], ['shqiponja_bike', 'shqiponja_officer'],
];
export function forceDispatch(stars, slot = 0) {
  const index = Math.max(0, Math.floor(Number.isFinite(slot) ? slot : 0));
  const [forceVehicle, forceCharacter] = stars >= 5
    ? ['renea_armored_van', 'army_soldier']
    : stars >= 4 ? ['renea_armored_van', 'renea_officer']
      : stars >= 3 ? ['fnsh_armored_van', 'fnsh_officer']
        : stars >= 2 ? SHQIPONJA[index % SHQIPONJA.length]
          : PATROL[index % PATROL.length];
  return {forceVehicle, forceCharacter};
}
export function forceVehicleFor(car) {
  const explicit = FORCE_ASSET_BY_ID.get(car.forceVehicle);
  if (explicit?.category === 'vehicle') return explicit;
  // Existing saves and older servers still get a compatible model.
  return FORCE_ASSET_BY_ID.get(car.model === 'police' ? 'patrol_hatch'
    : car.model === 'military-suv' ? 'renea_armored_van' : '');
}
export function forceCharacterFor(npc) {
  if (!['police', 'soldier', 'military'].includes(npc.kind)) return undefined;
  const explicit = FORCE_ASSET_BY_ID.get(npc.forceCharacter);
  return explicit?.category === 'person' ? explicit
    : FORCE_ASSET_BY_ID.get(npc.kind === 'police' ? 'patrol_officer' : 'army_soldier');
}
