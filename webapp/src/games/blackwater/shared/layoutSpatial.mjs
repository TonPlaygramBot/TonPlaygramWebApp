import {spatialIndex} from '../../tirana-city-completion/placementCore.mjs';

const roadBounds=({road:r})=>[Math.min(r.a[0],r.b[0]),Math.min(r.a[1],r.b[1]),Math.max(r.a[0],r.b[0]),Math.max(r.a[1],r.b[1])];
/** Exact original nearest-segment result, including source-order ties. A closer
 * segment must intersect the searched square once best.distance <= radius. */
export function createNearestRoadIndex(roads,size=128){
 const items=roads.map((road,index)=>({road,index})),near=spatialIndex(items,roadBounds,size);
 return (x,z)=>{
  let best,bestIndex=Infinity;
  const seen=new Set();
  const examine=({road:r,index})=>{
   if(seen.has(index))return;seen.add(index);
   const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],l=dx*dx+dz*dz;
   const t=l?Math.max(0,Math.min(1,((x-r.a[0])*dx+(z-r.a[1])*dz)/l)):0;
   const px=r.a[0]+dx*t,pz=r.a[1]+dz*t,d=Math.hypot(x-px,z-pz);
   if(d<(best?.distance??Infinity)||(d===best?.distance&&index<bestIndex)){
    best={x:px,z:pz,road:r,distance:d};bestIndex=index;
   }
  };
  if(Number.isFinite(x)&&Number.isFinite(z)){
   for(let radius=size;radius<=size*16;radius*=2){
    for(const item of near(x,z,radius))examine(item);
    if(best&&best.distance<=radius)return best;
   }
  }
  // Unusual off-map requests stay exact without traversing an enormous grid.
  for(const item of items)examine(item);
  return best;
 };
}

export const obstacleBlocks=(o,x,z,r,footprintDistance)=>o.footprint
 ?footprintDistance(x,z,o.footprint,o.holes)<r
 :Math.hypot(x-o.x,z-o.z)<Math.hypot(o.w,o.d)/2+r;
const obstacleBounds=o=>{
 if(o.footprint){
  let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
  for(const [x,z] of o.footprint){x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x);z1=Math.max(z1,z);}
  return [x0,z0,x1,z1];
 }
 const radius=Math.hypot(o.w,o.d)/2;
 return [o.x-radius,o.z-radius,o.x+radius,o.z+radius];
};
/** Broad phase only: the original polygon/courtyard or circle test decides.
 * Callers must create a new query when adding/removing obstacle records. */
export function createObstacleClearance(obstacles,footprintDistance,size=64){
 const near=spatialIndex(obstacles,obstacleBounds,size);
 return (x,z,r=.5)=>!(Number.isFinite(x)&&Number.isFinite(z)&&Number.isFinite(r)&&r>=0?near(x,z,r):obstacles)
  .some(o=>obstacleBlocks(o,x,z,r,footprintDistance));
}
