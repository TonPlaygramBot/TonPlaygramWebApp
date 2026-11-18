import { SNAKE_FPS_GUN_MODEL_CONFIG } from '../config/snakeWeaponCatalog.js';
const CAPTURE_PARK_BOX_TARGET_SIZE = 0.17;
const CAPTURE_PARKED_WEAPON_VISUAL_SCALE = 1.24;
const LARGE_RACK_FIREARM_IDS = new Set([
  'ak47VolleyAttack',
  'mosinMarksmanAttack',
  'shotgunBlastAttack',
  'sniperShotAttack',
  'marksmanDmrAttack',
  'compactCarbineAttack',
  'polyShotgun01Attack',
  'polyAssaultRifle01Attack',
  'polyShotgun02Attack',
  'polyShotgun03Attack',
  'polyRobotLargeGunAttack',
  'polyRobotFlyingGunAttack',
  'polyBazooka01Attack',
  'polyGrenadeLauncher01Attack',
  'polyTank01Attack'
]);
const FIREARM_RACK_SIZE_MULTIPLIER_BY_ID = Object.freeze({
  fpsGunAttack: SNAKE_FPS_GUN_MODEL_CONFIG.ludoRackSizeMultiplier,
  glockSidearmAttack: 1,
  // May 9 05:00 table snapshot: keep these four legacy firearms at the exact
  // rack sizing used before the Gunify source/Poly Pizza additions.
  assaultRifleAttack: 1,
  uziSprayAttack: 1.65,
  sigsauerTacticalAttack: 1,
  smgBurstAttack: 1.65,
  ak47VolleyAttack: 2.2,
  krsvBurstAttack: 2.2,
  smithSidearmAttack: 1,
  mosinMarksmanAttack: 3.5,
  sniperShotAttack: 2.8,
  shotgunBlastAttack: 2.2,
  grenadeBlastAttack: 0.45,
  // Match the Poly Pizza / Quaternius + CreativeTrio weapon rack sizes used by Chess Battle Royal.
  polyShotgun01Attack: 2.2,
  polyAssaultRifle01Attack: 2.2,
  polyPistol01Attack: 2.2,
  polyRevolver01Attack: 2.2,
  polySawedOff01Attack: 2.2,
  polyRevolver02Attack: 2.2,
  polyShotgun02Attack: 2.2,
  polyShotgun03Attack: 2.2,
  polySmg01Attack: 2.2,
  polyRobotLargeGunAttack: 1.95,
  polyRobotFlyingGunAttack: 1.45,
  polyBazooka01Attack: 2.6,
  polyGrenadeLauncher01Attack: 2.35,
  polyDynamiteBomb01Attack: 1.22,
  polyMolotov01Attack: 0.92,
  polyGasTank01Attack: 1.28,
  polyHandGrenade01Attack: 0.48,
  polyTank01Attack: 2.3
});
const FIREARM_RACK_DISPLAY_TUNING = Object.freeze({
  default: Object.freeze({
    targetSizeMultiplier: 1.06,
    position: [0.078, 0, -0.014],
    rotation: [-Math.PI * 0.5, Math.PI * 0.02, 0]
  }),
  large: Object.freeze({
    targetSizeMultiplier: 1.9,
    position: [0.086, 0, -0.016],
    rotation: [-Math.PI * 0.5, Math.PI * 0.02, 0]
  })
});
const MAY_9_TABLE_FIREARM_DISPLAY_TUNING_BY_ID = Object.freeze({
  assaultRifleAttack: FIREARM_RACK_DISPLAY_TUNING.default,
  uziSprayAttack: FIREARM_RACK_DISPLAY_TUNING.default,
  sigsauerTacticalAttack: FIREARM_RACK_DISPLAY_TUNING.default,
  mosinMarksmanAttack: FIREARM_RACK_DISPLAY_TUNING.large
});
export function ludoParkedWeaponLength(id) {
 const tuning = MAY_9_TABLE_FIREARM_DISPLAY_TUNING_BY_ID[id] || (LARGE_RACK_FIREARM_IDS.has(id) ? FIREARM_RACK_DISPLAY_TUNING.large : FIREARM_RACK_DISPLAY_TUNING.default);
 return CAPTURE_PARK_BOX_TARGET_SIZE * tuning.targetSizeMultiplier * (FIREARM_RACK_SIZE_MULTIPLIER_BY_ID[id] ?? 1) * CAPTURE_PARKED_WEAPON_VISUAL_SCALE;
}
