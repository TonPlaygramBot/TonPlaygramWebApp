/** Authored in metres, Y up, +Z forward. Driver eyes are on the vehicle's left
 * (+X when facing +Z); scale/centering are applied by the asset adapter. */
export const MILITARY_ASSETS = Object.freeze({
  shota: { file: 'shota', eye: [0.54, 2.29, 0.22], wheelRadius: 0.61, targetLength: 5.6 },
  'brabus-g': { file: 'brabus-g', eye: [0.48, 1.68, 0.12], wheelRadius: 0.4, targetLength: 4.9 },
  defender: { file: 'defender', eye: [0.46, 1.65, 0.2], wheelRadius: 0.405, targetLength: 5.0 },
  'brabus-s65': {
    file: 'brabus-s65',
    eye: [0.43, 1.31, 0.08],
    wheelRadius: 0.35,
    targetLength: 5.25
  }
});
export const FERRARI_ASSET_URL =
  'https://threejs.org/examples/models/gltf/ferrari.glb';
export function vehicleAssetUrl(id, low = false) {
  if (id === 'ferrari') return FERRARI_ASSET_URL;
  const config = MILITARY_ASSETS[id];
  return config
    ? `/assets/kart-royale/military/${config.file}${low ? '-lod' : ''}.glb`
    : `/assets/kart-royale/kenney-${id}.glb`;
}
export const vehicleTargetLength = (id) =>
  id === 'ferrari' ? 4.63 : MILITARY_ASSETS[id]?.targetLength || 2.7;
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
  const eye = MILITARY_ASSETS[id]?.eye;
  return eye
    ? eye.map((v, i) => v * fit.scale + fit.offset[i])
    : [0, 1.08, -0.1];
}
