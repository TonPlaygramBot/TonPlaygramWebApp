import {WORLD} from './world.mjs';
import {roadsNear,segmentDistance,onCarriageway} from './streetLayout.mjs';
import {footprintIndex} from '../../tirana-city-source/footprintIndex.mjs';
const buildingsNear=footprintIndex(WORLD.buildings,80,2);
const inside=(p,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];if((a[1]>p.z)!==(b[1]>p.z)&&p.x<(b[0]-a[0])*(p.z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
}return hit;};
export function clearStreetPoint(p,radius=.45) {
  if(onCarriageway(p.x,p.z,radius))return false;
  return !buildingsNear(p.x,p.z).some(b=>{
    const rings=[b.p,...(b.holes||[])];
    return inside(p,b.p)&&!(b.holes||[]).some(h=>inside(p,h)) || rings.some(r=>r.some((a,i)=>segmentDistance(p.x,p.z,a,r[(i+1)%r.length])<radius));
  });
}
/** Intersection test covers the entire railing, including a narrow lane between
 * clear endpoints. The same corrected segment feeds visuals and collision. */
export function segmentsDistance(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.min(segmentDistance(...a,c,d),segmentDistance(...b,c,d),segmentDistance(...c,a,b),segmentDistance(...d,a,b));
}
export function clearRoadSegment(a,b,pad=.3) {
  const roads=new Set(),length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(length/12));
  for(let i=0;i<=steps;i++)for(const r of roadsNear(a[0]+(b[0]-a[0])*i/steps,a[1]+(b[1]-a[1])*i/steps))roads.add(r);
  return ![...roads].some(r=>segmentsDistance(a,b,r.a,r.b)<r.w/2+pad);
}
/** Move a misplaced trunk/person to a clear verge of a nearby real road.
 * Intersections and building footprints must remain clear on the chosen side. */
export function roadsidePoint(p,radius=.5,force=false) {
  if(!force&&clearStreetPoint(p,radius))return {...p};
  const candidates=new Set();
  for(const dx of [-24,0,24])for(const dz of [-24,0,24])for(const r of roadsNear(p.x+dx,p.z+dz))candidates.add(r);
  const sites=[];
  for(const road of [...candidates].sort((a,b)=>segmentDistance(p.x,p.z,a.a,a.b)-segmentDistance(p.x,p.z,b.a,b.b)).slice(0,12)){
    const dx=road.b[0]-road.a[0],dz=road.b[1]-road.a[1],length=Math.hypot(dx,dz);if(length<1||road.bridge||road.tunnel)continue;
    const t=Math.max(0,Math.min(1,((p.x-road.a[0])*dx+(p.z-road.a[1])*dz)/(length*length)));
    for(const shift of [0,-4,4,-10,10])for(const side of [-1,1]){
      const along=Math.max(.05,Math.min(.95,t+shift/length)),offset=side*(road.w/2+radius+.85);
      const q={x:road.a[0]+dx*along+dz/length*offset,z:road.a[1]+dz*along-dx/length*offset};
      if(clearStreetPoint(q,radius))sites.push(q);
    }
  }
  sites.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  const q=sites.find(q=>Math.hypot(q.x-p.x,q.z-p.z)<24);
  return q?{...p,...q,sourceX:p.sourceX??p.x,sourceZ:p.sourceZ??p.z,placement:'Adjusted to the visible road verge'}:null;
}
