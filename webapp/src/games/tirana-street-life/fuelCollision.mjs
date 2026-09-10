import {FUEL_CANOPIES} from './fuelCanopyData.mjs';
export const FUEL_CANOPY_IDS=new Set(FUEL_CANOPIES.map(f=>f.id.slice(4)));
/** Same supports, pump islands and overhead roof as buildStreetModel().
 * Walk/drive under a roof; do not collide with its entire mapped footprint. */
export function fuelCanopyObstacles(origin={x:0,z:0}){
 const rows=[];
 for(const f of FUEL_CANOPIES){
  const add=(x,z,w,d,h,minY=0)=>{
   const c=Math.cos(f.yaw),s=Math.sin(f.yaw),wx=f.x-origin.x+x*c+z*s,wz=f.z-origin.z-x*s+z*c;
   const p=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[wx+a*c+b*s,wz-a*s+b*c]);
   rows.push({id:`${f.id}:${rows.length}`,x:wx,z:wz,w,d,h:h+.12,minY:minY?minY+.12:0,rot:f.yaw,p,footprint:p});
  };
  for(const side of [-1,1]){
   const x=side*f.width*.29;add(x,0,.25,.25,4);add(x,0,1.45,Math.min(1.15,f.depth*.35),.24);add(x,0,.7,.5,1.565);
  }
  add(0,0,f.width,f.depth,4.29,4.01);
 }
 return rows;
}
