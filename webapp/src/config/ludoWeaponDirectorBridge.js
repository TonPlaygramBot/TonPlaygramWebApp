// Bridge contract between Unity's BattleRoyaleWeaponDirector.cs and web broadcast logic.
// Keep these values in sync with WeaponBallisticsProfile / LudoWeaponType.
export const LUDO_WEAPON_DIRECTOR_BRIDGE = Object.freeze({
  weaponTypeByCaptureAnimationId: Object.freeze({
    glockSidearmAttack: 'Pistol',
    smithSidearmAttack: 'Pistol',
    sigsauerTacticalAttack: 'Pistol',
    polyPistol01Attack: 'Pistol',
    polyRevolver01Attack: 'Pistol',
    polyRevolver02Attack: 'Pistol',
    uziSprayAttack: 'SMG',
    smgBurstAttack: 'SMG',
    polySmg01Attack: 'SMG',
    polyFlareGun01Attack: 'Pistol',
    assaultRifleAttack: 'Rifle',
    ak47VolleyAttack: 'Rifle',
    fpsGunAttack: 'Rifle',
    compactCarbineAttack: 'Rifle',
    polyAssaultRifle01Attack: 'Rifle',
    sniperShotAttack: 'Sniper',
    mosinMarksmanAttack: 'Sniper',
    marksmanDmrAttack: 'Sniper',
    shotgunBlastAttack: 'Shotgun',
    polyShotgun01Attack: 'Shotgun',
    polyShotgun02Attack: 'Shotgun',
    polyShotgun03Attack: 'Shotgun',
    polySawedOff01Attack: 'Shotgun',
    grenadeBlastAttack: 'GrenadeLauncher',
    polyRpgLauncher01Attack: 'GrenadeLauncher',
    polyBazooka01Attack: 'GrenadeLauncher',
    polyRocketLauncher01Attack: 'GrenadeLauncher',
    polyGrenadeLauncher01Attack: 'GrenadeLauncher',
    polyScifiGrenadeLauncher01Attack: 'GrenadeLauncher',
    polyGrenade01Attack: 'GrenadeLauncher',
    polyScifiGrenade01Attack: 'GrenadeLauncher',
    polyFireGrenade01Attack: 'GrenadeLauncher',
    polyLandmine01Attack: 'GrenadeLauncher',
    polyGasTank01Attack: 'GrenadeLauncher',
    polyTurretGun01Attack: 'GrenadeLauncher',
    polyCombatTank01Attack: 'GrenadeLauncher'
  }),
  firearmBroadcastProfile: Object.freeze({
    aimLift: 0.064,
    aimRearPullback: 0.124,
    bulletFollowStart: 0.08,
    bulletFollowEnd: 0.998,
    bulletTargetBlend: 0.84,
    bulletFollowLift: 0.092,
    bulletFollowRearPullback: 0.138,
    impactHoldTtl: 1.85
  })
});

