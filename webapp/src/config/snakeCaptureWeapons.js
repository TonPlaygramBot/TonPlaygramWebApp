import { CAPTURE_ANIMATION_OPTIONS } from './ludoBattleOptions.js';

export const SNAKE_CAPTURE_WEAPON_OPTIONS = Object.freeze(
  CAPTURE_ANIMATION_OPTIONS.map((option) => ({
    id: option.id,
    label: option.label,
    thumbnail: option.thumbnail
  }))
);

export const SNAKE_CAPTURE_WEAPON_KIND_MAP = Object.freeze({
  missileJavelin: 'javelin',
  droneAttack: 'drone',
  fighterJetAttack: 'fighter',
  helicopterAttack: 'helicopter',
  fpsGunAttack: 'supportTruck',
  glockSidearmAttack: 'supportTruck',
  pistolSidearmAttack: 'supportTruck',
  assaultRifleAttack: 'supportTruck',
  uziSprayAttack: 'supportTruck',
  ak47VolleyAttack: 'supportTruck',
  krsvBurstAttack: 'supportTruck',
  smithSidearmAttack: 'supportTruck',
  mosinMarksmanAttack: 'supportTruck',
  sigsauerTacticalAttack: 'supportTruck',
  grenadeBlastAttack: 'supportTruck',
  shotgunBlastAttack: 'supportTruck',
  sniperShotAttack: 'supportTruck',
  smgBurstAttack: 'supportTruck',
  compactCarbineAttack: 'supportTruck',
  marksmanDmrAttack: 'supportTruck',
  polyShotgun01Attack: 'supportTruck',
  polyAssaultRifle01Attack: 'supportTruck',
  polyPistol01Attack: 'supportTruck',
  polyRevolver01Attack: 'supportTruck',
  polySawedOff01Attack: 'supportTruck',
  polyRevolver02Attack: 'supportTruck',
  polyShotgun02Attack: 'supportTruck',
  polyShotgun03Attack: 'supportTruck',
  polySmg01Attack: 'supportTruck'
});

export const LUDO_CAPTURE_ATTACK_TUNING_BY_WEAPON = Object.freeze({
  fighter: Object.freeze({ speed: 0.92, height: 0.92, inward: 0.94, takeoff: 0.22, landing: 0.26 }),
  helicopter: Object.freeze({ speed: 0.94, height: 0.92, inward: 0.94, takeoff: 0.22, landing: 0.26 }),
  drone: Object.freeze({ speed: 0.86, height: 0.92, inward: 0.94, takeoff: 0.22, landing: 0.26 }),
  javelin: Object.freeze({ speed: 0.86, height: 0.92, inward: 0.94, takeoff: 0.22, landing: 0.26 }),
  supportTruck: Object.freeze({ speed: 0.86, height: 0.92, inward: 0.94, takeoff: 0.22, landing: 0.26 })
});

export function normalizeSnakeCaptureWeaponKind(weaponType = 'fighter') {
  return SNAKE_CAPTURE_WEAPON_KIND_MAP[weaponType] || weaponType || 'fighter';
}
