/** Authored axes of the shipped assets, checked against all 41 weapon entries.
 * Forward is the bore direction AFTER base rotation; +Y is the upright reference.
 * Never infer barrel sign from the longest bounding-box axis. */
export const WEAPON_CALIBRATIONS = Object.freeze({
  "adaptiveCombatRifleAttack.glb": {"base":[0,0,0],"forward":[0,0.263913,0.964546],"up":[0,1,0]},
  "dragunovAttack.glb": {"base":[0,0,0],"forward":[-0.0325,0.0348,0.998866],"up":[0,1,0]},
  "vityazAttack.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "ar15Attack.glb": {"base":[0,0,0],"forward":[0,0.093604,0.995609],"up":[0,1,0]},
  "makarovAttack.glb": {"base":[0,0,0],"forward":[0.285469,-0.404857,0.868676],"up":[-0.4536,0.6428,0.6173]},
  "combat-knife.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "fpsGunAttack.gltf": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "sigsauer.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "ak47.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "uzi.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "krsv.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "smith.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,-1],"up":[0,1,0]},
  "mosin.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "grenade.glb": {"base":[1.5707963267948966,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "shotgun.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyShotgun01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyAssaultRifle01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyPistol01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyRevolver01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polySawedOff01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyRevolver02Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyShotgun02Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polyShotgun03Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "polySmg01Attack.glb": {"base":[0,-1.5707963267948966,0],"forward":[0,0,1],"up":[0,1,0]},
  "q-rifle.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "q-smg.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "launcher.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "awpSniperAttack.glb": {"base":[0,0,0],"forward":[0,0,-1],"up":[0,1,0]},
  "mrtkGunAttack.glb": {"base":[0,0,0],"forward":[0,0,1],"up":[0,1,0]}
});
export const WEAPON_OPTICS = Object.freeze({
  adaptiveCombatRifleAttack: {zoom:1.5, rise:.048},
  vityazAttack: {zoom:1.5, rise:.065},
  dragunovAttack: {zoom:4, rise:.055},
  ar15Attack: {zoom:3, rise:.055},
  awpSniperAttack: {zoom:6, rise:.065}
});

const OPTIC_ALIASES={acr:'adaptiveCombatRifleAttack',dragunov:'dragunovAttack',vityaz:'vityazAttack',ar15:'ar15Attack'};
export function opticZoom(id){return WEAPON_OPTICS[OPTIC_ALIASES[id]||id]?.zoom||1;}
