import {ROUNDABOUTS} from './roundabouts.mjs';
import {roadsidePoint} from './streetSafety.mjs';
export function junctionPhase(site,time){
 const offset=Number(site.id)%8,phase=(time+offset)%28;
 return phase<12?'north-south':phase<14?'clear':phase<26?'east-west':'clear';
}
export function createTrafficOfficers(){
 return ROUNDABOUTS.flatMap(s=>{
  let p;for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   p=roadsidePoint({x:s.x+Math.cos(angle)*(s.radius+7),z:s.z+Math.sin(angle)*(s.radius+7)},.5,true);if(p)break;
  }
  return p?[{...p,id:`traffic-control-${s.id}`,kind:'police',role:'traffic-controller',junctionId:s.id,
   forceCharacter:'traffic_officer',motion:'idle',anim:'direct',heading:0,speed:0,health:100,weapon:null,downUntil:0}]:[];
 });
}
/** Meter incoming approaches, while cars already circulating can clear the ring. */
export function roundaboutGap(car,time){
 let gap=Infinity;
 for(const s of ROUNDABOUTS){
  const dx=car.x-s.x,dz=car.z-s.z,d=Math.hypot(dx,dz);
  if(d<s.radius+4||d>s.radius+36)continue;
  const fx=-Math.sin(car.heading),fz=-Math.cos(car.heading);
  if((-dx*fx-dz*fz)/d<.7)continue;
  const axis=Math.abs(dx)>Math.abs(dz)?'east-west':'north-south';
  if(junctionPhase(s,time)!==axis)gap=Math.min(gap,Math.max(0,d-s.radius-5-(car.d||4.5)/2));
 }
 return gap;
}
export function directTraffic(n,time){
 const s=ROUNDABOUTS.find(s=>s.id===n.junctionId);if(!s)return;
 n.trafficPhase=junctionPhase(s,time);n.heading=n.trafficPhase==='east-west'?Math.PI/2:0;
 n.speed=0;n.anim='direct';
}
