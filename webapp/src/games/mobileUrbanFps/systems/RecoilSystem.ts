import * as THREE from 'three';

export const recoilConfig = {
  maxWeaponRecoil: 0.11,
  recoveryScale: 0.035,
  kickUpScale: 0.34,
  kickBackScale: 1.35
} as const;

export function recoverWeaponRecoil(
  recoil: number,
  recovery: number,
  dt: number
) {
  return Math.max(0, recoil - recovery * dt * recoilConfig.recoveryScale);
}

export function applyFirstPersonRecoil(
  group: THREE.Group,
  recoil: number,
  base = { x: 0.48, y: -0.42, z: -0.86 }
) {
  group.position.x = base.x;
  group.position.z = base.z + recoil * recoilConfig.kickBackScale;
  group.position.y = base.y + recoil * recoilConfig.kickUpScale;
}
