import { createLudoBlenderModel } from './ludoBlenderMeshes';
import * as THREE from 'three';
import { LUDO_WEAPON_DIRECTOR_BRIDGE } from '../config/ludoWeaponDirectorBridge.js';

// Shared from Ludo Battle Royal: both games use the same firearm profiles and effects.

export const FIREARM_CAPTURE_ANIMATION_IDS = new Set([
  'assaultRifleAttack',
  'fpsGunAttack',
  'glockSidearmAttack',
  'uziSprayAttack',
  'ak47VolleyAttack',
  'krsvBurstAttack',
  'smithSidearmAttack',
  'mosinMarksmanAttack',
  'sigsauerTacticalAttack',
  'grenadeBlastAttack',
  'shotgunBlastAttack',
  'sniperShotAttack',
  'smgBurstAttack',
  'compactCarbineAttack',
  'marksmanDmrAttack',
  'polyShotgun01Attack',
  'polyAssaultRifle01Attack',
  'polyPistol01Attack',
  'polyRevolver01Attack',
  'polySawedOff01Attack',
  'polyRevolver02Attack',
  'polyShotgun02Attack',
  'polyShotgun03Attack',
  'polySmg01Attack',
  'polyRobotLargeGunAttack',
  'polyRobotFlyingGunAttack',
  'polyBazooka01Attack',
  'polyGrenadeLauncher01Attack',
  'polyDynamiteBomb01Attack',
  'polyMolotov01Attack',
  'polyGasTank01Attack',
  'polyHandGrenade01Attack',
  'polyTank01Attack'
]);

export const FIREARM_BARREL_RADIUS_BY_ID = Object.freeze({
  glockSidearmAttack: 0.0032,
  pistolSidearmAttack: 0.0032,
  pistolHolsterAttack: 0.0032,
  smithSidearmAttack: 0.0034,
  sigsauerTacticalAttack: 0.0032,
  uziSprayAttack: 0.0031,
  smgBurstAttack: 0.0031,
  assaultRifleAttack: 0.0038,
  ak47VolleyAttack: 0.004,
  fpsGunAttack: 0.0038,
  krsvBurstAttack: 0.0038,
  compactCarbineAttack: 0.0037,
  mosinMarksmanAttack: 0.0042,
  sniperShotAttack: 0.0044,
  shotgunBlastAttack: 0.004,
  polyAssaultRifle01Attack: 0.0038,
  polyPistol01Attack: 0.0032,
  polyRevolver01Attack: 0.0034,
  polyRevolver02Attack: 0.0034,
  polyShotgun01Attack: 0.004,
  polyShotgun02Attack: 0.004,
  polyShotgun03Attack: 0.004,
  polySmg01Attack: 0.0031
});

export const FIREARM_SHOTGUN_IDS = new Set([
  'shotgunBlastAttack',
  'polyShotgun01Attack',
  'polyShotgun02Attack',
  'polyShotgun03Attack',
  'polySawedOff01Attack'
]);
export const FIREARM_MARKSMAN_IDS = new Set(['sniperShotAttack', 'mosinMarksmanAttack', 'marksmanDmrAttack']);
export const FIREARM_SCATTER_PROJECTILE_IDS = new Set([...FIREARM_SHOTGUN_IDS]);
export const FIREARM_MAGAZINE_SHOTS = Object.freeze({
  mrtkGunAttack: 22,
  pistolHolsterAttack: 14,
  fpsGunAttack: 24,
  glockSidearmAttack: 17,
  pistolSidearmAttack: 16,
  assaultRifleAttack: 30,
  uziSprayAttack: 32,
  ak47VolleyAttack: 30,
  krsvBurstAttack: 30,
  smithSidearmAttack: 16,
  mosinMarksmanAttack: 1,
  sigsauerTacticalAttack: 20,
  grenadeBlastAttack: 1,
  shotgunBlastAttack: 1,
  sniperShotAttack: 1,
  smgBurstAttack: 28,
  compactCarbineAttack: 30,
  marksmanDmrAttack: 1,
  polyShotgun01Attack: 1,
  polyAssaultRifle01Attack: 30,
  polyPistol01Attack: 16,
  polyRevolver01Attack: 8,
  polySawedOff01Attack: 1,
  polyRevolver02Attack: 8,
  polyShotgun02Attack: 1,
  polyShotgun03Attack: 1,
  polySmg01Attack: 28,
  polyRobotLargeGunAttack: 18,
  polyRobotFlyingGunAttack: 16,
  polyBazooka01Attack: 1,
  polyGrenadeLauncher01Attack: 1,
  polyDynamiteBomb01Attack: 1,
  polyMolotov01Attack: 1,
  polyGasTank01Attack: 1,
  polyHandGrenade01Attack: 1,
  polyTank01Attack: 1
});
export const FIREARM_BALLISTICS_PROFILE = Object.freeze({
  default: Object.freeze({ tracerSpread: 0.018, shellDriftX: 0.00026, shellDriftZ: -0.00021, shellArc: 0.052, bulletRadius: 0.0036, bulletLength: 0.032, bulletSpeed: 0.2, shellRadius: 0.0028, shellLength: 0.016, projectileKind: 'jacketed-round', caliberLabel: 'generic battle round' }),
  pistol: Object.freeze({ tracerSpread: 0.013, shellDriftX: 0.00022, shellDriftZ: -0.00016, shellArc: 0.042, bulletRadius: 0.0034, bulletLength: 0.027, bulletSpeed: 0.21, shellRadius: 0.0026, shellLength: 0.014, projectileKind: 'pistol-round', caliberLabel: '9mm sidearm round' }),
  smg: Object.freeze({ tracerSpread: 0.022, shellDriftX: 0.00031, shellDriftZ: -0.00025, shellArc: 0.058, bulletRadius: 0.0032, bulletLength: 0.028, bulletSpeed: 0.23, shellRadius: 0.0025, shellLength: 0.014, projectileKind: 'smg-round', caliberLabel: '9mm SMG round' }),
  rifle: Object.freeze({ tracerSpread: 0.016, shellDriftX: 0.00027, shellDriftZ: -0.00022, shellArc: 0.054, bulletRadius: 0.0038, bulletLength: 0.041, bulletSpeed: 0.26, shellRadius: 0.003, shellLength: 0.021, projectileKind: 'rifle-round', caliberLabel: '5.56 rifle round' }),
  marksman: Object.freeze({ tracerSpread: 0.01, shellDriftX: 0.0002, shellDriftZ: -0.00014, shellArc: 0.036, bulletRadius: 0.0042, bulletLength: 0.052, bulletSpeed: 0.29, shellRadius: 0.0032, shellLength: 0.024, projectileKind: 'marksman-round', caliberLabel: '7.62 marksman round' }),
  shotgun: Object.freeze({ tracerSpread: 0.026, shellDriftX: 0.00034, shellDriftZ: -0.00026, shellArc: 0.061, bulletRadius: 0.0032, bulletLength: 0.013, bulletSpeed: 0.17, shellRadius: 0.004, shellLength: 0.023, projectileKind: 'buckshot-pellet', caliberLabel: '12-gauge buckshot' }),
  explosive: Object.freeze({ tracerSpread: 0.03, shellDriftX: 0.00018, shellDriftZ: -0.00012, shellArc: 0.03, bulletRadius: 0.0064, bulletLength: 0.046, bulletSpeed: 0.14, shellRadius: 0.0046, shellLength: 0.03, projectileKind: 'explosive-warhead', caliberLabel: 'explosive warhead' })
});
export const FIREARM_BALLISTICS_PROFILE_BY_ID = Object.freeze({
  glockSidearmAttack: 'pistol',
  pistolSidearmAttack: 'pistol',
  pistolHolsterAttack: 'pistol',
  smithSidearmAttack: 'pistol',
  sigsauerTacticalAttack: 'pistol',
  polyPistol01Attack: 'pistol',
  polyRevolver01Attack: 'pistol',
  polyRevolver02Attack: 'pistol',
  uziSprayAttack: 'smg',
  smgBurstAttack: 'smg',
  polySmg01Attack: 'smg',
  fpsGunAttack: 'rifle',
  assaultRifleAttack: 'rifle',
  ak47VolleyAttack: 'rifle',
  krsvBurstAttack: 'rifle',
  compactCarbineAttack: 'rifle',
  polyAssaultRifle01Attack: 'rifle',
  mosinMarksmanAttack: 'marksman',
  sniperShotAttack: 'marksman',
  marksmanDmrAttack: 'marksman',
  shotgunBlastAttack: 'shotgun',
  polyShotgun01Attack: 'shotgun',
  polyShotgun02Attack: 'shotgun',
  polyShotgun03Attack: 'shotgun',
  polySawedOff01Attack: 'shotgun',
  grenadeBlastAttack: 'explosive',
  polyHandGrenade01Attack: 'explosive',
  polyDynamiteBomb01Attack: 'explosive',
  polyMolotov01Attack: 'explosive',
  polyGasTank01Attack: 'explosive',
  polyBazooka01Attack: 'explosive',
  polyGrenadeLauncher01Attack: 'explosive',
  polyTank01Attack: 'explosive',
  polyRobotLargeGunAttack: 'rifle',
  polyRobotFlyingGunAttack: 'smg'
});
export const FIREARM_CALIBER_BY_ID = Object.freeze({
  glockSidearmAttack: { caliberLabel: '9×19mm Glock round', projectileKind: 'pistol-round', bulletRadius: 0.0032, bulletLength: 0.027, shellRadius: 0.0024, shellLength: 0.014, bulletSpeed: 0.22 },
  smithSidearmAttack: { caliberLabel: '.38 revolver round', projectileKind: 'revolver-round', bulletRadius: 0.0034, bulletLength: 0.029, shellRadius: 0.0025, shellLength: 0.016, bulletSpeed: 0.215 },
  sigsauerTacticalAttack: { caliberLabel: '9×19mm tactical round', projectileKind: 'pistol-round', bulletRadius: 0.0032, bulletLength: 0.028, shellRadius: 0.0024, shellLength: 0.014, bulletSpeed: 0.22 },
  polyPistol01Attack: { caliberLabel: '9×19mm low-poly round', projectileKind: 'pistol-round', bulletRadius: 0.0032, bulletLength: 0.027, shellRadius: 0.0024, shellLength: 0.014, bulletSpeed: 0.22 },
  polyRevolver01Attack: { caliberLabel: '.38 heavy revolver round', projectileKind: 'revolver-round', bulletRadius: 0.0035, bulletLength: 0.03, shellRadius: 0.0026, shellLength: 0.017, bulletSpeed: 0.21 },
  polyRevolver02Attack: { caliberLabel: '.38 silver revolver round', projectileKind: 'revolver-round', bulletRadius: 0.0035, bulletLength: 0.03, shellRadius: 0.0026, shellLength: 0.017, bulletSpeed: 0.21 },
  uziSprayAttack: { caliberLabel: '9×19mm Uzi round', projectileKind: 'smg-round', bulletRadius: 0.0031, bulletLength: 0.028, shellRadius: 0.0022, shellLength: 0.013, bulletSpeed: 0.24 },
  smgBurstAttack: { caliberLabel: '9×19mm SMG burst round', projectileKind: 'smg-round', bulletRadius: 0.0031, bulletLength: 0.028, shellRadius: 0.0022, shellLength: 0.013, bulletSpeed: 0.24 },
  polySmg01Attack: { caliberLabel: '9×19mm low-poly SMG round', projectileKind: 'smg-round', bulletRadius: 0.0031, bulletLength: 0.028, shellRadius: 0.0022, shellLength: 0.013, bulletSpeed: 0.24 },
  assaultRifleAttack: { caliberLabel: '5.56×45mm rifle round', projectileKind: 'rifle-round', bulletRadius: 0.0038, bulletLength: 0.041, shellRadius: 0.0029, shellLength: 0.021, bulletSpeed: 0.27 },
  ak47VolleyAttack: { caliberLabel: '7.62×39mm AK round', projectileKind: 'rifle-round', bulletRadius: 0.004, bulletLength: 0.045, shellRadius: 0.0031, shellLength: 0.023, bulletSpeed: 0.265 },
  fpsGunAttack: { caliberLabel: '5.56×45mm tactical rifle round', projectileKind: 'rifle-round', bulletRadius: 0.0038, bulletLength: 0.041, shellRadius: 0.0029, shellLength: 0.021, bulletSpeed: 0.27 },
  krsvBurstAttack: { caliberLabel: '5.56×45mm KRSV round', projectileKind: 'rifle-round', bulletRadius: 0.0038, bulletLength: 0.041, shellRadius: 0.0029, shellLength: 0.021, bulletSpeed: 0.27 },
  compactCarbineAttack: { caliberLabel: '5.56×45mm carbine round', projectileKind: 'rifle-round', bulletRadius: 0.0037, bulletLength: 0.039, shellRadius: 0.0028, shellLength: 0.02, bulletSpeed: 0.265 },
  polyAssaultRifle01Attack: { caliberLabel: '5.56×45mm low-poly rifle round', projectileKind: 'rifle-round', bulletRadius: 0.0038, bulletLength: 0.041, shellRadius: 0.0029, shellLength: 0.021, bulletSpeed: 0.27 },
  sniperShotAttack: { caliberLabel: '.338 sniper round', projectileKind: 'sniper-round', bulletRadius: 0.0045, bulletLength: 0.058, shellRadius: 0.0034, shellLength: 0.027, bulletSpeed: 0.3 },
  mosinMarksmanAttack: { caliberLabel: '7.62×54mmR marksman round', projectileKind: 'marksman-round', bulletRadius: 0.0044, bulletLength: 0.055, shellRadius: 0.0033, shellLength: 0.026, bulletSpeed: 0.3 },
  marksmanDmrAttack: { caliberLabel: '7.62×51mm DMR round', projectileKind: 'marksman-round', bulletRadius: 0.0042, bulletLength: 0.052, shellRadius: 0.0032, shellLength: 0.024, bulletSpeed: 0.292 },
  shotgunBlastAttack: { caliberLabel: '12-gauge buckshot', projectileKind: 'buckshot-pellet', bulletRadius: 0.0034, bulletLength: 0.014, shellRadius: 0.0042, shellLength: 0.024, bulletSpeed: 0.18 },
  polyShotgun01Attack: { caliberLabel: '12-gauge buckshot', projectileKind: 'buckshot-pellet', bulletRadius: 0.0033, bulletLength: 0.014, shellRadius: 0.0041, shellLength: 0.024, bulletSpeed: 0.18 },
  polyShotgun02Attack: { caliberLabel: '12-gauge long-shell buckshot', projectileKind: 'buckshot-pellet', bulletRadius: 0.0034, bulletLength: 0.014, shellRadius: 0.0042, shellLength: 0.025, bulletSpeed: 0.18 },
  polyShotgun03Attack: { caliberLabel: '12-gauge pump buckshot', projectileKind: 'buckshot-pellet', bulletRadius: 0.0034, bulletLength: 0.014, shellRadius: 0.0042, shellLength: 0.025, bulletSpeed: 0.18 },
  polySawedOff01Attack: { caliberLabel: '12-gauge sawed-off buckshot', projectileKind: 'buckshot-pellet', bulletRadius: 0.0036, bulletLength: 0.013, shellRadius: 0.0044, shellLength: 0.023, bulletSpeed: 0.17 },
  grenadeBlastAttack: { caliberLabel: '40mm grenade shell', projectileKind: 'grenade-round', bulletRadius: 0.0062, bulletLength: 0.046, shellRadius: 0.0047, shellLength: 0.03, bulletSpeed: 0.14 },
  polyBazooka01Attack: { caliberLabel: '60mm rocket warhead', projectileKind: 'rocket-warhead', bulletRadius: 0.0072, bulletLength: 0.06, shellRadius: 0.0052, shellLength: 0.034, bulletSpeed: 0.13 },
  polyGrenadeLauncher01Attack: { caliberLabel: '40mm launcher grenade', projectileKind: 'grenade-round', bulletRadius: 0.0068, bulletLength: 0.049, shellRadius: 0.005, shellLength: 0.032, bulletSpeed: 0.135 },
  polyDynamiteBomb01Attack: { caliberLabel: 'dynamite charge', projectileKind: 'explosive-charge', bulletRadius: 0.0064, bulletLength: 0.05, shellRadius: 0.0048, shellLength: 0.03, bulletSpeed: 0.13 },
  polyMolotov01Attack: { caliberLabel: 'molotov bottle', projectileKind: 'incendiary-bottle', bulletRadius: 0.0065, bulletLength: 0.052, shellRadius: 0.0048, shellLength: 0.03, bulletSpeed: 0.128 },
  polyGasTank01Attack: { caliberLabel: 'gas-tank explosive canister', projectileKind: 'explosive-canister', bulletRadius: 0.007, bulletLength: 0.058, shellRadius: 0.0051, shellLength: 0.033, bulletSpeed: 0.125 },
  polyHandGrenade01Attack: { caliberLabel: 'fragmentation hand grenade', projectileKind: 'frag-grenade', bulletRadius: 0.0066, bulletLength: 0.044, shellRadius: 0.0049, shellLength: 0.031, bulletSpeed: 0.132 },
  polyTank01Attack: { caliberLabel: 'tank cannon shell', projectileKind: 'cannon-shell', bulletRadius: 0.0075, bulletLength: 0.068, shellRadius: 0.0054, shellLength: 0.036, bulletSpeed: 0.12 },
  polyRobotLargeGunAttack: { caliberLabel: 'heavy robot rifle round', projectileKind: 'rifle-round', bulletRadius: 0.0042, bulletLength: 0.047, shellRadius: 0.0032, shellLength: 0.024, bulletSpeed: 0.255 },
  polyRobotFlyingGunAttack: { caliberLabel: 'drone SMG micro-round', projectileKind: 'smg-round', bulletRadius: 0.003, bulletLength: 0.026, shellRadius: 0.0021, shellLength: 0.012, bulletSpeed: 0.235 }
});

export const FIREARM_VOLLEY_SLOW_FACTOR = 2.08;


export const FIREARM_RECOIL_ROTATION_RAD = 0.026;


export const FIREARM_RECOIL_RECOVER_MS = 94;


export const FIREARM_FINAL_BULLET_SLOWMO_FACTOR = 0.105;


export const FIREARM_FINAL_BULLET_SPIN_RATE = 0.118;


export const FIREARM_NON_FINAL_BULLET_CINEMATIC_FACTOR = 0.46;


export const FIREARM_TARGET_RETICLE_SIZE = 0.04;


export function resolveFirearmBallisticsProfile(captureAnimationId = '') {
  const profileKey = FIREARM_BALLISTICS_PROFILE_BY_ID[captureAnimationId] || 'default';
  return FIREARM_BALLISTICS_PROFILE[profileKey] || FIREARM_BALLISTICS_PROFILE.default;
}

export function matchProjectileDiameterToBarrel(profile: FirearmBallistics = FIREARM_BALLISTICS_PROFILE.default, captureAnimationId = '') {
  const barrelRadius = FIREARM_BARREL_RADIUS_BY_ID[captureAnimationId] ?? profile.bulletRadius ?? FIREARM_BALLISTICS_PROFILE.default.bulletRadius;
  return {
    ...profile,
    bulletRadius: barrelRadius,
    // The shell casing uses the same visual diameter as the visible barrel/bore so bullets,
    // ejected brass and muzzle opening read as one caliber during the close-up camera shot.
    shellRadius: Math.max(profile.shellRadius, barrelRadius * 1.06)
  };
}

export function addFxSphere(
  group,
  radius,
  position,
  color,
  roughness = 0.45,
  metalness = 0.25,
  transparent = false,
  opacity = 1
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent, opacity })
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function createCaptureBulletTracerFx(color = '#ffe8a3') {
  const root = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0048, 0.0048, 0.12, 8),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    })
  );
  core.rotation.z = Math.PI / 2;
  root.add(core);
  root.visible = false;
  return { root, core };
}

export function createCaptureShellCasingFx() {
  const root = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.016, 10),
    new THREE.MeshStandardMaterial({ color: '#d4a64a', metalness: 0.88, roughness: 0.22 })
  );
  root.castShadow = true;
  root.receiveShadow = true;
  root.visible = false;
  return root;
}

export function createCaliberProjectileFx(profile: FirearmBallistics = FIREARM_BALLISTICS_PROFILE.default) {
  const kind = profile.projectileKind || 'jacketed-round';
  const radius = profile.bulletRadius || 0.0036;
  const length = profile.bulletLength || radius * 9;
  const meshKey = kind === 'incendiary-bottle' ? 'molotov-bottle' : kind;
  const supported = new Set(['pistol-round', 'smg-round', 'revolver-round', 'rifle-round', 'marksman-round', 'sniper-round', 'jacketed-round', 'buckshot-pellet', 'rocket-warhead', 'explosive-warhead', 'cannon-shell', 'grenade-round', 'frag-grenade', 'explosive-charge', 'molotov-bottle', 'explosive-canister']);
  const root = createLudoBlenderModel(supported.has(meshKey) ? meshKey : 'jacketed-round');
  root.scale.set(radius, kind.includes('buckshot') ? radius * 2 : length, radius);
  root.name = `caliber-projectile-${kind}`;
  root.userData.dispose = () => {
    root.traverse((object) => {
      const node = object as THREE.Mesh;
      if (!node?.isMesh) return;
      node.geometry?.dispose?.();
      if (Array.isArray(node.material)) node.material.forEach((mat) => mat?.dispose?.());
      else node.material?.dispose?.();
    });
  };
  root.visible = false;
  return root;
}

export function createCaliberShellCasingFx(profile: FirearmBallistics = FIREARM_BALLISTICS_PROFILE.default) {
  const kind = profile.projectileKind || '';
  const radius = profile.shellRadius || 0.004;
  const length = profile.shellLength || 0.016;
  const isShotgun = kind.includes('shotgun') || kind.includes('buckshot');
  const bottleneck = /rifle|marksman|sniper/.test(kind);
  const root = createLudoBlenderModel(isShotgun ? 'shotgun-case' : bottleneck ? 'rifle-case' : 'pistol-case');
  root.scale.set(radius, length, radius);
  root.name = `caliber-shell-${profile.caliberLabel || 'round'}`;
  root.castShadow = true;
  root.receiveShadow = true;
  root.visible = false;
  return root;
}

export function createBulletAerodynamicRingsFx() {
  const root = new THREE.Group();
  const rings = Array.from({ length: 4 }, (_, idx) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.018 + idx * 0.006, 0.00085, 8, 42),
      new THREE.MeshBasicMaterial({
        color: idx % 2 === 0 ? '#dbeafe' : '#ffffff',
        transparent: true,
        opacity: 0.34 - idx * 0.055,
        depthWrite: false
      })
    );
    ring.position.y = -idx * 0.018;
    root.add(ring);
    return ring;
  });
  root.userData.rings = rings;
  root.visible = false;
  return root;
}

export function createCaptureMuzzleFx() {
  const root = new THREE.Group();
  const flash = addFxSphere(root, 0.06, [0, 0, 0], '#ffd78a', 0.05, 0, true, 0.95);
  const smoke = addFxSphere(root, 0.075, [0.03, 0, 0], '#8b929b', 0.95, 0, true, 0.42);
  root.visible = false;
  return { root, flash, smoke };
}

export function createCaptureTargetReticleFx(size = FIREARM_TARGET_RETICLE_SIZE) {
  const root = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(size * 0.62, size, 48),
    new THREE.MeshBasicMaterial({
      color: '#ff3f3f',
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  root.add(ring);
  const lineMaterial = new THREE.MeshBasicMaterial({
    color: '#ff8f8f',
    transparent: true,
    opacity: 0.86,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.55, size * 0.07), lineMaterial.clone());
  horizontal.rotation.x = -Math.PI / 2;
  root.add(horizontal);
  const vertical = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.07, size * 1.55), lineMaterial.clone());
  vertical.rotation.x = -Math.PI / 2;
  root.add(vertical);
  root.visible = false;
  return { root, ring, horizontal, vertical };
}

export type FirearmBallistics = { weaponId?: string; tracerSpread: number; shellDriftX: number; shellDriftZ: number; shellArc: number; bulletRadius: number; bulletLength: number; bulletSpeed: number; shellRadius: number; shellLength: number; projectileKind: string; caliberLabel: string };

export function getLudoFirearmTiming(id: string) {
  const shots = FIREARM_MAGAZINE_SHOTS[id] ?? 18;
  const cadenceMs = (FIREARM_MARKSMAN_IDS.has(id) ? 155 : FIREARM_SHOTGUN_IDS.has(id) ? 92 : 56) * FIREARM_VOLLEY_SLOW_FACTOR;
  const pickupLeadMs = 420, reloadLeadMs = 260, aimLeadMs = 340;
  const preFireLeadMs = pickupLeadMs + reloadLeadMs + aimLeadMs;
  return { shots, cadenceMs, pickupLeadMs, reloadLeadMs, aimLeadMs, preFireLeadMs,
    durationMs: preFireLeadMs + shots * cadenceMs + 1100,
    pelletsPerShot: FIREARM_SCATTER_PROJECTILE_IDS.has(id) ? 14 : 1 };
}

export function getLudoFirearmBallistics(id: string): FirearmBallistics {
  const weaponType = LUDO_WEAPON_DIRECTOR_BRIDGE.weaponTypeByCaptureAnimationId[id] ?? 'Rifle';
  const bias = weaponType === 'Sniper' ? { bulletSpeed: 0.3, tracerSpread: 0.009 }
    : weaponType === 'Shotgun' ? { tracerSpread: 0.026 } : weaponType === 'SMG' ? { tracerSpread: 0.022 } : {};
  const profile = matchProjectileDiameterToBarrel({ ...resolveFirearmBallisticsProfile(id), ...bias, ...FIREARM_CALIBER_BY_ID[id] }, id);
  return { ...profile, weaponId: id, caliberLabel: FIREARM_CALIBER_BY_ID[id]?.caliberLabel || `${id}: ${profile.caliberLabel}` };
}

export function sampleLudoFirearmVolley(elapsed: number, timing: ReturnType<typeof getLudoFirearmTiming>) {
  const elapsedShooting = Math.max(0, elapsed - timing.preFireLeadMs);
  const firing = elapsed >= timing.preFireLeadMs && elapsedShooting < timing.shots * timing.cadenceMs;
  const shotIndex = Math.floor(elapsedShooting / timing.cadenceMs);
  const recoil = firing ? 1 - Math.min(1, (elapsedShooting % timing.cadenceMs) / FIREARM_RECOIL_RECOVER_MS) : 0;
  return { elapsedShooting, firing, shotIndex, recoil };
}
