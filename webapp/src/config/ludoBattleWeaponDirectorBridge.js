// Bridge module that keeps Web Ludo firearm broadcast tuning aligned with
// Unity's BattleRoyaleWeaponDirector weapon families.

export const LUDO_WEAPON_TYPE = Object.freeze({
  RIFLE: 'Rifle',
  SMG: 'SMG',
  PISTOL: 'Pistol',
  SHOTGUN: 'Shotgun',
  SNIPER: 'Sniper',
  GRENADE_LAUNCHER: 'GrenadeLauncher'
});

export const CAPTURE_ATTACK_TO_WEAPON_TYPE = Object.freeze({
  fpsGunAttack: LUDO_WEAPON_TYPE.RIFLE,
  assaultRifleAttack: LUDO_WEAPON_TYPE.RIFLE,
  ak47VolleyAttack: LUDO_WEAPON_TYPE.RIFLE,
  krsvBurstAttack: LUDO_WEAPON_TYPE.RIFLE,
  compactCarbineAttack: LUDO_WEAPON_TYPE.RIFLE,
  polyAssaultRifle01Attack: LUDO_WEAPON_TYPE.RIFLE,
  uziSprayAttack: LUDO_WEAPON_TYPE.SMG,
  smgBurstAttack: LUDO_WEAPON_TYPE.SMG,
  polySmg01Attack: LUDO_WEAPON_TYPE.SMG,
  glockSidearmAttack: LUDO_WEAPON_TYPE.PISTOL,
  pistolSidearmAttack: LUDO_WEAPON_TYPE.PISTOL,
  pistolHolsterAttack: LUDO_WEAPON_TYPE.PISTOL,
  smithSidearmAttack: LUDO_WEAPON_TYPE.PISTOL,
  sigsauerTacticalAttack: LUDO_WEAPON_TYPE.PISTOL,
  polyPistol01Attack: LUDO_WEAPON_TYPE.PISTOL,
  polyRevolver01Attack: LUDO_WEAPON_TYPE.PISTOL,
  polyRevolver02Attack: LUDO_WEAPON_TYPE.PISTOL,
  shotgunBlastAttack: LUDO_WEAPON_TYPE.SHOTGUN,
  polyShotgun01Attack: LUDO_WEAPON_TYPE.SHOTGUN,
  polyShotgun02Attack: LUDO_WEAPON_TYPE.SHOTGUN,
  polyShotgun03Attack: LUDO_WEAPON_TYPE.SHOTGUN,
  polySawedOff01Attack: LUDO_WEAPON_TYPE.SHOTGUN,
  sniperShotAttack: LUDO_WEAPON_TYPE.SNIPER,
  mosinMarksmanAttack: LUDO_WEAPON_TYPE.SNIPER,
  marksmanDmrAttack: LUDO_WEAPON_TYPE.SNIPER,
  grenadeBlastAttack: LUDO_WEAPON_TYPE.GRENADE_LAUNCHER
});

export const WEAPON_DIRECTOR_BROADCAST_CAMERA_PROFILE = Object.freeze({
  [LUDO_WEAPON_TYPE.RIFLE]: Object.freeze({ followLift: 0.09, followPullback: 0.14 }),
  [LUDO_WEAPON_TYPE.SMG]: Object.freeze({ followLift: 0.088, followPullback: 0.13 }),
  [LUDO_WEAPON_TYPE.PISTOL]: Object.freeze({ followLift: 0.084, followPullback: 0.124 }),
  [LUDO_WEAPON_TYPE.SHOTGUN]: Object.freeze({ followLift: 0.094, followPullback: 0.136 }),
  [LUDO_WEAPON_TYPE.SNIPER]: Object.freeze({ followLift: 0.096, followPullback: 0.142 }),
  [LUDO_WEAPON_TYPE.GRENADE_LAUNCHER]: Object.freeze({ followLift: 0.1, followPullback: 0.146 })
});

export function resolveDirectorWeaponType(captureAnimationId) {
  return CAPTURE_ATTACK_TO_WEAPON_TYPE[captureAnimationId] ?? LUDO_WEAPON_TYPE.RIFLE;
}

