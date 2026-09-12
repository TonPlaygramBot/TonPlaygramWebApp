import clipping from 'polygon-clipping';
const ringKey=ring=>{
 const points=ring.map(p=>p.join(','));if(points[0]===points.at(-1))points.pop();
 const rotate=p=>p.map((_,i)=>[...p.slice(i),...p.slice(0,i)].join(';')).sort()[0];
 return [rotate(points),rotate([...points].reverse())].sort()[0];
};
export function removeExactDuplicates(buildings){
 const seen=new Map(),duplicates=[],retained=[];
 for(const b of buildings){
  const key=[ringKey(b.p),...(b.holes||[]).map(ringKey).sort(),b.h,b.minHeight||0].join('|');
  if(seen.has(key)){duplicates.push({id:b.id,retained:seen.get(key),reason:'Identical footprint, holes and vertical extent'});continue;}
  seen.set(key,b.id);retained.push(b);
 }
 return {buildings:retained,duplicates};
}
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
/** A park can surround a lake. Grass at +5 cm must not cover water at +3 cm. */
export function cutWaterFromParks(features,water){
 const lakes=water.flatMap(w=>w.polygons||[]).map(p=>({...p,bounds:bounds(p.outer)}));
 let corrected=0;
 const result=features.flatMap(f=>{
  const candidates=lakes.filter(l=>overlaps(bounds(f.p),l.bounds));if(!candidates.length)return [f];
  const pieces=clipping.difference([f.p,...(f.holes||[])],...candidates.map(l=>[l.outer,...l.holes]));
  const ringArea=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
  const area=p=>ringArea(p[0])-p.slice(1).reduce((s,h)=>s+ringArea(h),0);
  if(Math.abs(area([f.p,...(f.holes||[])])-pieces.reduce((s,p)=>s+area(p),0))<.01)return [f];
  corrected++;
  return pieces.map((p,i)=>({...f,id:i?`${f.id}/surface-${i}`:f.id,p:p[0].slice(0,-1),holes:p.slice(1).map(h=>h.slice(0,-1))}));
 });
 return {features:result,corrected};
}
