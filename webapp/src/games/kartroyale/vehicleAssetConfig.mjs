export const KART_ASSETS = Object.freeze(
  Object.fromEntries(
    [
      ['apex', 0.265],
      ['oobi', 0.265],
      ['oodi', 0.275],
      ['ooli', 0.285],
      ['oopi', 0.34]
    ].map(([file, wheelRadius]) => [
      file,
      { file, wheelRadius, eye: [0, file === 'oopi' ? 1.15 : 1.05, -0.28] }
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
  const config = MILITARY_ASSETS[id];
  if (KART_ASSETS[id])
    return `/assets/kart-royale/karts/${id}${low ? '-lod' : ''}.glb`;
  return config
    ? `/assets/kart-royale/military/${config.file}${low ? '-lod' : ''}.glb`
    : `/assets/kart-royale/kenney-${id}.glb`;
}
// 3.25 m keeps the stylised racers substantial beside the widened street
// circuit (the former 2.7 m target read like a toy on a phone display).
export function normaliseVehicleDimensions({ min, max }, targetLength = 3.25) {
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
  const eye = (MILITARY_ASSETS[id] || KART_ASSETS[id])?.eye;
  return eye
    ? eye.map((v, i) => v * fit.scale + fit.offset[i])
    : [0, 1.08, -0.1];
}
