/** Arcade ratings shared with the server; not real vehicle specifications. */
export const ALBANIAN_FORCES_VEHICLES = Object.freeze([
  {
    id: 'patrol_hatch',
    name: 'Patrullë · Focus',
    detail: 'Policia · patrol hatchback',
    speed: 1,
    handling: 1.04,
    brake: 1.04,
    shield: 78,
    ammunition: 3
  },
  {
    id: 'patrol_sedan',
    name: 'Patrullë · Impreza',
    detail: 'Policia · Impreza hatchback',
    speed: 1.05,
    handling: 1.02,
    brake: 1,
    shield: 76,
    ammunition: 3
  },
  {
    id: 'shqiponja_compact',
    name: 'Shqiponja · Focus',
    detail: 'Shqiponja · compact response car',
    speed: 1.06,
    handling: 1.07,
    brake: 1.02,
    shield: 72,
    ammunition: 3
  },
  {
    id: 'police_van',
    name: 'Policia · Sprinter',
    detail: 'Policia · transport van',
    speed: 0.9,
    handling: 0.9,
    brake: 1.1,
    shield: 90,
    ammunition: 2
  },
  {
    id: 'fnsh_armored_van',
    name: 'FNSH · Sprinter',
    detail: 'FNSH · transport van',
    speed: 0.92,
    handling: 0.91,
    brake: 1.08,
    shield: 92,
    ammunition: 2
  },
  {
    id: 'renea_armored_van',
    name: 'RENEA · 4×4',
    detail: 'RENEA · armoured response vehicle',
    speed: 0.9,
    handling: 0.94,
    brake: 1.12,
    shield: 100,
    ammunition: 2
  },
  {
    id: 'traffic_bike',
    name: 'Rrugore · Motorcycle',
    detail: 'Traffic police · touring motorcycle',
    speed: 1.08,
    handling: 1.1,
    brake: 1.02,
    shield: 58,
    ammunition: 3
  },
  {
    id: 'shqiponja_bike',
    name: 'Shqiponja · Motorcycle',
    detail: 'Shqiponja · response motorcycle',
    speed: 1.1,
    handling: 1.12,
    brake: 1,
    shield: 56,
    ammunition: 3
  }
]);
export const ALBANIAN_FORCES_CHARACTERS = Object.freeze([
  'patrol_officer',
  'traffic_officer',
  'shqiponja_officer',
  'fnsh_officer',
  'renea_officer',
  'army_soldier'
]);
export const isAlbanianForcesVehicle = (id) =>
  ALBANIAN_FORCES_VEHICLES.some((v) => v.id === id);
export function albanianForcesAssetUrl(id, low = false) {
  if (!isAlbanianForcesVehicle(id) && !ALBANIAN_FORCES_CHARACTERS.includes(id))
    throw Error('Unknown Albanian Forces asset');
  return `/assets/kart-royale/albanian-forces/${id}${low ? '-lod' : ''}.glb`;
}
/** Supplied vehicles face +X. Eyes below are after turning to +Z. Elevated
 * bonnet/helmet mounts clear opaque glass; these are not calibrated seats. */
export const ALBANIAN_FORCES_ASSETS = Object.freeze({
  patrol_hatch: { eye: [0, 1.7, 1.55], wheelRadius: 0.33 },
  patrol_sedan: { eye: [0, 1.8, 1.7], wheelRadius: 0.33 },
  shqiponja_compact: { eye: [0, 1.7, 1.55], wheelRadius: 0.33 },
  police_van: { eye: [0, 2.8, 3.3], wheelRadius: 0.375 },
  fnsh_armored_van: { eye: [0, 2.8, 3.3], wheelRadius: 0.375 },
  renea_armored_van: { eye: [0, 2.7, 2.3], wheelRadius: 0.51 },
  traffic_bike: { eye: [0, 1.75, 0.25], wheelRadius: 0.33 },
  shqiponja_bike: { eye: [0, 1.75, 0.25], wheelRadius: 0.33 }
});
