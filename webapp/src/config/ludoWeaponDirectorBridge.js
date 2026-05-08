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
    grenadeBlastAttack: 'GrenadeLauncher'
  }),
  firearmBroadcastProfile: Object.freeze({
    aimLift: 0.078,
    aimRearPullback: 0.15,
    bulletFollowStart: 0.055,
    bulletFollowEnd: 0.998,
    bulletTargetBlend: 0.9,
    bulletFollowLift: 0.104,
    bulletFollowRearPullback: 0.16,
    impactHoldTtl: 2.08
  })
});

