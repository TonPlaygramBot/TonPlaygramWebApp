import { boostPads } from './arcadeRules.mjs';
import { sampleCircuitDistance, cornerSpeedLimit } from './circuitMetrics.mjs';
import { surfaceHeight } from './racingSurface.mjs';
const cache = new WeakMap();
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

/** Event ramps on long, clear approaches. The same profiles position the
 * meshes and drive fixed-step takeoff; their landing corridor stays on course. */
export function jumpRamps(track) {
  if (cache.has(track)) return cache.get(track);
  const ramps = [];
  if (track.roadFeelVersion === 1) for (const pad of boostPads(track)) {
    if (pad.distance < 70 || track.length-pad.distance < 90 ||
        cornerSpeedLimit(track,pad,85)<37 ||
        ramps.some(r=>Math.hypot(r.x-pad.x,r.z-pad.z)<280)) continue;
    const s=Math.sin(pad.yaw),c=Math.cos(pad.yaw);
    const clear=[15,30,45,60].every(d=>{
      const p=sampleCircuitDistance(track,pad.distance+d);
      return Math.abs((p.x-pad.x)*c-(p.z-pad.z)*s)<Math.max(1,(p.width??track.width)/2-3) &&
        Math.abs(surfaceHeight(track,p.x,p.z)-surfaceHeight(track,pad.x,pad.z))<d*.13;
    });
    if(!clear)continue;
    ramps.push({...pad,id:ramps.length,length:10,width:Math.min(5.6,(track.points[pad.index].width??track.width)-2),height:.95});
    if(ramps.length>=4)break;
  }
  cache.set(track,ramps);return ramps;
}

export function resetJump(r,track) {
  r.airborne=false;r.jumpHeight=0;r.jumpVelocity=0;r.jumpPitch=0;
  r.groundY=surfaceHeight(track,r.x,r.z);r.jumpY=r.groundY;
  r.jumpCooldown=0;r.landingImpact=0;
}

export function stepJumps(r,track,dt,time,previousX,previousZ) {
  const ground=surfaceHeight(track,r.x,r.z);
  r.groundY=ground;r.landingImpact=(r.landingImpact||0)*Math.exp(-dt*10);
  if(r.airborne){
    r.jumpVelocity-=14*dt;r.jumpY+=r.jumpVelocity*dt;
    if(r.jumpY<=ground){
      r.landingImpact=clamp(-r.jumpVelocity/10,0,1);
      r.bumpImpact=Math.max(r.bumpImpact||0,r.landingImpact);
      r.speed*=1-r.landingImpact*.025;
      r.airborne=false;r.jumpY=ground;r.jumpVelocity=0;
    }
    r.jumpHeight=Math.max(0,r.jumpY-ground);
    r.jumpPitch=r.airborne?-Math.atan2(r.jumpVelocity,Math.max(8,Math.abs(r.speed)))*.65:0;
    return;
  }
  r.jumpHeight=0;r.jumpPitch=0;
  for(const ramp of jumpRamps(track)){
    const s=Math.sin(ramp.yaw),c=Math.cos(ramp.yaw);
    const along=(r.x-ramp.x)*s+(r.z-ramp.z)*c;
    const old=(previousX-ramp.x)*s+(previousZ-ramp.z)*c;
    const across=(r.x-ramp.x)*c-(r.z-ramp.z)*s;
    if(Math.abs(across)>ramp.width/2-.2)continue;
    if(along>=-ramp.length/2&&along<=ramp.length/2){
      r.jumpHeight=ramp.height*(along/ramp.length+.5);
      r.jumpPitch=-Math.atan(ramp.height/ramp.length);
    }
    if(old<ramp.length/2&&along>=ramp.length/2&&along-old>0&&
       r.speed>8&&Math.cos(r.velocityYaw-ramp.yaw)>.8&&time>=(r.jumpCooldown||0)){
      r.airborne=true;r.jumpVelocity=clamp(3.4+r.speed*.075,4,7.4);
      r.jumpY=ground+ramp.height;r.jumpHeight=ramp.height;
      r.jumpCooldown=time+2;r.turbo=Math.max(r.turbo,1.35);
      r.boost=Math.min(100,r.boost+18);r.boostEvent=(r.boostEvent||0)+1;
      r.drifting=false;r.driftCharge=0;break;
    }
  }
}
