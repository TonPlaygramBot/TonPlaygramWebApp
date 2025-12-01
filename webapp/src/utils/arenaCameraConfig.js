export const ARENA_CAMERA_DEFAULTS = Object.freeze({
  fov: 52,
  near: 0.1,
  far: 5000,
  initialRadiusFactor: 1.35,
  minRadiusFactor: 0.95,
  maxRadiusFactor: 3.1,
  initialPhiLerp: 0.35,
  phiMin: 0.92,
  phiMax: 1.22,
  verticalSensitivity: 0.003,
  leanStrength: 0.0065,
  wheelDeltaFactor: 0.2
});

export function buildArenaCameraConfig(boardSize) {
  return Object.freeze({
    fov: ARENA_CAMERA_DEFAULTS.fov,
    near: ARENA_CAMERA_DEFAULTS.near,
    far: ARENA_CAMERA_DEFAULTS.far,
    minRadius: boardSize * ARENA_CAMERA_DEFAULTS.minRadiusFactor,
    maxRadius: boardSize * ARENA_CAMERA_DEFAULTS.maxRadiusFactor
  });
}
