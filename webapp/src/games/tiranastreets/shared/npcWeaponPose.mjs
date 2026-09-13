import {weaponAnchors} from '../street-career/weaponPose.mjs';
/** Original force rigs face local +Z. This pose also supplies the simulation muzzle. */
export function npcWeaponPose(n) {
  const a=weaponAnchors(n.weapon),aim=n.anim==='aim'||n.anim==='spray';
  const pitch=aim?Math.max(-.7,Math.min(.7,n.aimPitch||0)):n.anim==='reload'?.65:-.5;
  const origin={x:-.06,y:aim?1.38:1.05,z:aim?.33-a.length*.35:.2};
  const transform=v=>({x:origin.x+v.x,y:origin.y+Math.cos(pitch)*v.y+Math.sin(pitch)*v.z,z:origin.z-Math.sin(pitch)*v.y+Math.cos(pitch)*v.z});
  const local={origin,pitch,length:a.length,right:transform(a.rightGrip),left:transform(a.leftSupport),muzzle:transform(a.muzzle)};
  const yaw=n.heading||0,toWorld=v=>({x:n.x-Math.cos(yaw)*v.x-Math.sin(yaw)*v.z,y:(n.y||0)+.06+v.y,z:n.z+Math.sin(yaw)*v.x-Math.cos(yaw)*v.z});
  return {...local,worldMuzzle:toWorld(local.muzzle)};
}
