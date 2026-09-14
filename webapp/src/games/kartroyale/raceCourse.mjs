import { WORLD } from '../tiranastreets/shared/world.mjs';
import { segmentDistance } from '../tirana-street-detail/roadDetailCore.mjs';
import clipping from 'polygon-clipping';
import {circuitSides} from './trackEdges.mjs';

const grid = new Map(), cell = 48;
for (const building of WORLD.buildings) {
  const xs=building.p.map(p=>p[0]),zs=building.p.map(p=>p[1]);
  for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++)
    for(let z=Math.floor(Math.min(...zs)/cell);z<=Math.floor(Math.max(...zs)/cell);z++) {
      const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(building.p);
    }
}
function inside(x,z,ring) {
  let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }return yes;
}
export function buildingClearance(x,z) {
  let result=24;const seen=new Set();
  for(let i=Math.floor((x-24)/cell);i<=Math.floor((x+24)/cell);i++)
    for(let j=Math.floor((z-24)/cell);j<=Math.floor((z+24)/cell);j++)
      for(const polygon of grid.get(`${i},${j}`)||[]) {
        if(seen.has(polygon))continue;seen.add(polygon);
        if(inside(x,z,polygon))return 0;
        for(let k=0;k<polygon.length;k++)result=Math.min(result,segmentDistance(x,z,polygon[k],polygon[(k+1)%polygon.length]));
      }
  return result;
}

const waters=(WORLD.waterAreas||[]).flatMap(w=>w.polygons).map(p=>({p,
  bounds:[Math.min(...p.outer.map(v=>v[0])),Math.min(...p.outer.map(v=>v[1])),Math.max(...p.outer.map(v=>v[0])),Math.max(...p.outer.map(v=>v[1]))]}));
export function waterClearance(x,z){
  let distance=24;
  for(const {p,bounds:b} of waters){
    if(x<b[0]-24||z<b[1]-24||x>b[2]+24||z>b[3]+24)continue;
    if(inside(x,z,p.outer)&&!(p.holes||[]).some(h=>inside(x,z,h)))return 0;
    for(const ring of [p.outer,...(p.holes||[])])for(let i=0;i<ring.length;i++)distance=Math.min(distance,segmentDistance(x,z,ring[i],ring[(i+1)%ring.length]));
  }return distance;
}
export const courseClearance=(track,x,z)=>Math.min(buildingClearance(x,z),track.terrainMode?waterClearance(x,z):24);

/** The source road ribbon bounds any race-only corner smoothing. */
export function courseRoadSurface(raw,roadWidths){
  // Join the mapped road widths at their shared nodes. Raw rectangular road
  // tiles leave pinholes on the outside of bends; a bounded miter closes that
  // junction without adding lanes or widening either adjoining road.
  const points=raw.map((p,i)=>({x:p[0],z:p[1],width:Math.min(roadWidths[i],roadWidths[(i+raw.length-1)%raw.length])}));
  const {left,right}=circuitSides(points,Math.max(...roadWidths)/2),pieces=[];
  const xy=p=>[Math.round(p.x*1000)/1000,Math.round(p.z*1000)/1000];
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length;
    for(const triangle of [[left[i],left[j],right[i]],[right[i],left[j],right[j]]]){
      const ring=triangle.map(xy);pieces.push([[...ring,ring[0]]]);
    }
  }
  const polygons=clipping.union(...pieces);
  return {polygons,contains(x,z){return polygons.some(p=>inside(x,z,p[0])&&!p.slice(1).some(h=>inside(x,z,h)));},
    clearance(x,z){
      if(!this.contains(x,z))return 0;
      let d=32;for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++)d=Math.min(d,segmentDistance(x,z,ring[i-1],ring[i]));
      return d;
    }};
}

/** Rounded junction approaches share one centreline with physics, AI, kerbs,
 * minimaps and vegetation masks. */
export function roundRaceCourse(raw, roadWidths, roadSurface=courseRoadSurface(raw,roadWidths)) {
  const points=[],widths=[],turns=[];
  const add=(p,w)=>{
    const previous=points.at(-1);if(previous&&Math.hypot(previous[0]-p[0],previous[1]-p[1])<.01)return;
    const available=2*(buildingClearance(...p)-.85);
    points.push(p);widths.push(Math.max(.5,Math.min(w,available)));
  };
  for(let i=0;i<raw.length;i++) {
    const p=raw[i],a=raw[(i+raw.length-1)%raw.length],b=raw[(i+1)%raw.length];
    const li=Math.hypot(p[0]-a[0],p[1]-a[1]),lo=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const incoming=[(p[0]-a[0])/li,(p[1]-a[1])/li],outgoing=[(b[0]-p[0])/lo,(b[1]-p[1])/lo];
    const angle=Math.acos(Math.max(-1,Math.min(1,incoming[0]*outgoing[0]+incoming[1]*outgoing[1])));
    const width=Math.min(roadWidths[i],roadWidths[(i+raw.length-1)%raw.length]);
    if(angle<.12||angle>2.8){add([...p],width);continue;}
    let trim=Math.min(12,width*.1,li*.42,lo*.42),curve=[],bestCurve,bestTrim=trim,bestClearance=-1;
    for(let attempt=0;attempt<7;attempt++) {
      const entry=[p[0]-incoming[0]*trim,p[1]-incoming[1]*trim],exit=[p[0]+outgoing[0]*trim,p[1]+outgoing[1]*trim];
      const steps=Math.max(4,Math.ceil(trim*1.1));
      curve=Array.from({length:steps+1},(_,j)=>{const t=j/steps,u=1-t;return [u*u*entry[0]+2*u*t*p[0]+t*t*exit[0],u*u*entry[1]+2*u*t*p[1]+t*t*exit[1]];});
      const clearance=Math.min(...curve.map(q=>Math.min(buildingClearance(...q)-.85,roadSurface.clearance(...q))));
      if(clearance>bestClearance){bestClearance=clearance;bestCurve=curve;bestTrim=trim;}
      if(clearance>=width*.4)break;
      trim*=.65;
    }
    curve=bestCurve;trim=bestTrim;
    for(const q of curve)add(q,width);
    turns.push({x:p[0],z:p[1],trim,angle});
  }
  return {points,widths,turns};
}
