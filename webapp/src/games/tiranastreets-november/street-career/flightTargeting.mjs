import {groundHeight} from '../../tirana-east/terrainCore.mjs';
export const LOCK_SECONDS=.75;
export const LOCK_RANGE=700;
export function targetPoint(target){return {x:target.x,y:(target.y??groundHeight(target.x,target.z))+1,z:target.z};}
export function targetDirection(origin,target){
  const point=targetPoint(target),x=point.x-origin.x,y=point.y-origin.y,z=point.z-origin.z,distance=Math.hypot(x,y,z);
  return {point,distance,direction:{x:x/(distance||1),y:y/(distance||1),z:z/(distance||1)}};
}
export function findFlightTarget(sim,aircraft,yaw,pitch,retainedId=null){
  const look={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
  const cars=sim.cars(),candidates=[];
  for(const target of cars){
    if(target.id===aircraft.id||target.destroyed||target.health<=0||target.driver===sim.player.id)continue;
    const aim=targetDirection(aircraft,target);
    if(aim.distance<12||aim.distance>LOCK_RANGE)continue;
    const dot=look.x*aim.direction.x+look.y*aim.direction.y+look.z*aim.direction.z;
    if(dot<Math.cos((target.id===retainedId?18:10)*Math.PI/180))continue;
    const rank=dot-aim.distance/LOCK_RANGE*.015+(target.id===retainedId?.04:0);
    candidates.push({target,aim,rank});
  }
  // The full traffic fleet remains in the simulation; only a few near-reticle
  // candidates need expensive world/vehicle visibility sweeps each 100 ms.
  candidates.sort((a,b)=>b.rank-a.rank);
  for(const {target,aim} of candidates.slice(0,12)){
    const hit=sim.world.cast(aircraft,aim.direction,aim.distance,cars);
    if(hit.kind==='air'||hit.objectId===target.id)return target;
  }
  return null;
}

/** Bounded arcade seeker steering. Lost/occluded targets leave a ballistic
 * missile; the same world sweep still resolves buildings and vehicles. */
export function guideMissile(missile,target,dt){
  const desired=targetDirection(missile,target).direction,current=missile.direction;
  const dot=Math.max(-1,Math.min(1,current.x*desired.x+current.y*desired.y+current.z*desired.z));
  const angle=Math.acos(dot),blend=angle<1e-5?1:Math.min(1,Math.max(0,dt)*1.6/angle);
  const x=current.x+(desired.x-current.x)*blend,y=current.y+(desired.y-current.y)*blend,z=current.z+(desired.z-current.z)*blend,length=Math.hypot(x,y,z)||1;
  missile.direction={x:x/length,y:y/length,z:z/length};
}
