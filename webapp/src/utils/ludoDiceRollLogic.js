const DICE_FACE_EULERS = Object.freeze({
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0]
});

export function rollLudoDieValue(rng = Math.random) {
  const sample = typeof rng === 'function' ? rng() : Math.random();
  const normalized = Number.isFinite(sample) ? Math.min(Math.max(sample, 0), 0.999999999999) : Math.random();
  return 1 + Math.floor(normalized * 6);
}

export function rollLudoDiceValues(count = 1, rng = Math.random) {
  const diceCount = Math.max(1, Math.floor(Number(count) || 1));
  return Array.from({ length: diceCount }, () => rollLudoDieValue(rng));
}

export function sumLudoDiceValues(values) {
  if (Array.isArray(values)) {
    return values.reduce((sum, value) => sum + (Number(value) || 0), 0);
  }
  return Number(values) || 0;
}

export function hasLudoSix(values) {
  if (Array.isArray(values)) return values.some((value) => Number(value) === 6);
  return Number(values) === 6;
}

export function createLudoDiceSpinVector(THREE, rng = Math.random) {
  return new THREE.Vector3(
    1.2 + rng() * 0.7,
    1.35 + rng() * 0.65,
    1.05 + rng() * 0.75
  );
}

export function createLudoDiceWobbleVector(THREE, rng = Math.random) {
  return new THREE.Vector3((rng() - 0.5) * 0.16, 0, (rng() - 0.5) * 0.16);
}

export function getLudoDiceOrientationQuaternion(THREE, value) {
  const face = DICE_FACE_EULERS[Number(value)] || DICE_FACE_EULERS[1];
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...face));
}

export function setLudoDiceOrientation(THREE, dice, value, quaternion) {
  const q = quaternion ?? getLudoDiceOrientationQuaternion(THREE, value);
  dice?.setRotationFromQuaternion?.(q);
  return q;
}
