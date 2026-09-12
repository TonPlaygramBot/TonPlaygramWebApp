import { COLLECTION_BY_ID } from '../tiranastreets/shared/vehicleCollection.mjs';

export const KART_ASSETS = Object.freeze(
  Object.fromEntries(
    [
      ['apex', 0.265],
      ['oobi', 0.265],
      ['oodi', 0.275],
      ['ooli', 0.285],
      ['oopi', 0.34], ['photon', .28], ['vortex', .28], ['aegis', .28]
    ].map(([file, wheelRadius]) => [
      file,
      { file, wheelRadius, eye: [0, file === 'oopi' ? 1.30 : 1.20, -0.28] }
    ])
  )
);
/** Authored in metres, Y up, +Z forward. Driver eyes are on the vehicle's left
 * (+X when facing +Z); scale/centering are applied by the asset adapter. */
export const MILITARY_ASSETS = Object.freeze({
  shota: { file: 'shota', eye: [0.54, 2.29, 0.22], wheelRadius: 0.61 },
  'brabus-g': { file: 'brabus-g', eye: [0.48, 1.68, 0.12], wheelRadius: 0.4 },
  defender: { file: 'defender', eye: [0.46, 1.65, 0.2], wheelRadius: 0.405 },
  'brabus-s65': {
    file: 'brabus-s65',
    eye: [0.43, 1.31, 0.08],
    wheelRadius: 0.35
  }
});
export function vehicleAssetUrl(id, low = false) {
  const collection = COLLECTION_BY_ID.get(id);
  if (collection) return collection.url;
  if (id === 'buggy')
    return `/assets/tirana-streets/imported/${id}.glb`;
  const config = MILITARY_ASSETS[id];
  if (KART_ASSETS[id])
    return `/assets/kart-royale/karts/${id}${low ? '-lod' : ''}.glb`;
  return config
    ? `/assets/kart-royale/military/${config.file}${low ? '-lod' : ''}.glb`
    : `/assets/kart-royale/kenney-${id}.glb`;
}
// All road and vehicle dimensions are metres. Collection cars retain their
// authored dimensions; karts use their physical 2.7 m footprint.
export function normaliseVehicleDimensions({ min, max }, targetLength = 2.7) {
  const length = max[2] - min[2];
  if (
    ![...min, ...max, targetLength].every(Number.isFinite) ||
    length <= 0 ||
    targetLength <= 0
  )
    throw Error('Invalid vehicle bounds');
  const scale = targetLength / length;
  return {
    scale,
    offset: [
      -(min[0] + max[0]) * 0.5 * scale,
      -min[1] * scale,
      -(min[2] + max[2]) * 0.5 * scale
    ]
  };
}
export function vehicleDriverMount(id, fit) {
  const collection = COLLECTION_BY_ID.get(id);
  if (collection) {
    // Collection cars are authored nose +X. After the adapter turns them to
    // race-forward +Z, native [x,y,z] becomes [-z,y,x].
    // driverSeat is the cushion/pelvis socket, not a camera socket.
    const [x, y, z] = collection.driverSeat;
    return [-z * fit.scale + fit.offset[0], (y + 0.62) * fit.scale + fit.offset[1],
      x * fit.scale + fit.offset[2]];
  }
  const eye = (MILITARY_ASSETS[id] || KART_ASSETS[id])?.eye;
  return eye
    ? eye.map((v, i) => v * fit.scale + fit.offset[i])
    : [0, 1.08, -0.1];
}

/** Physical lengths of the authored military fleet, before runtime fitting. */
export const VEHICLE_LENGTHS = Object.freeze({shota: 6.2, 'brabus-g': 4.82, defender: 4.76, 'brabus-s65': 5.3, buggy: 2.7});
export function cockpitStyle(id) {
  if (KART_ASSETS[id] || id === 'buggy') return 'kart';
  if (id === 'shota') return 'armored';
  if (['range','landrover','defender','brabus-g'].includes(id)) return 'suv';
  if (['bmw','ferrari','bugatti'].includes(id)) return 'sport';
  return 'sedan';
}
export const COCKPIT_URL = '/assets/kart-royale/cockpits/';
