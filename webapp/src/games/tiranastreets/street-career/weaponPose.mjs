import { WEAPON_BY_ID } from '../shared/weapons.mjs';
import { WEAPON_OPTICS } from '../shared/weaponCalibration.mjs';
import { direction3 } from './spatialCore.mjs';
/** Model and simulation use the same calibrated barrel, sight and ejection port. */
export function weaponAnchors(id) {
  const w=WEAPON_BY_ID.get(id),sidearm=w?.category==='sidearm';
  const length=w?.length||(w?.category==='melee'?.30:sidearm?.28:w?.radius?.72:.7);
  const optic=WEAPON_OPTICS[id];
  return {length,zoom:optic?.zoom||1,
    rightGrip:{x:0,y:-.045,z:-length*.2},
    leftSupport:{x:-.06,y:-.03,z:length*.35},
    muzzle:{x:0,y:.045,z:length*.72},
    ejection:{x:-.028,y:.025,z:length*.05},
    sight:{x:0,y:.045+(optic?.rise||.02),z:0}};
}
export function weaponPose(p,b) {
  const a=weaponAnchors(p.weapon),d=direction3(b.yaw,b.pitch);
  const wall=Math.max(0,Math.min(1,(.8-b.wall)/.6)),yaw=b.yaw,pitch=b.pitch-wall*.85;
  const forward=direction3(yaw,pitch),right={x:Math.cos(yaw),y:0,z:-Math.sin(yaw)};
  const up={x:Math.sin(yaw)*Math.sin(pitch),y:Math.cos(pitch),z:Math.cos(yaw)*Math.sin(pitch)};
  const side=b.aim?0:.15,low=b.aim?a.sight.y:.16,reach=.37-wall*.2;
  const origin={x:p.x+right.x*side+d.x*reach-up.x*low,
    y:b.y+b.eye+d.y*reach-up.y*low-wall*.27,
    z:p.z+right.z*side+d.z*reach-up.z*low};
  const transform=v=>({x:origin.x-right.x*v.x+up.x*v.y+forward.x*v.z,
    y:origin.y+up.y*v.y+forward.y*v.z,
    z:origin.z-right.z*v.x+up.z*v.y+forward.z*v.z});
  return {origin,muzzle:transform(a.muzzle),ejection:transform(a.ejection),sight:transform(a.sight),pitch,yaw,anchors:a,wall};
}
