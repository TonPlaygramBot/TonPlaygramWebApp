import { WORLD } from '../tiranastreets/shared/world.mjs';
import { segmentDistance } from '../tirana-street-detail/roadDetailCore.mjs';

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

/** A race-only surface inside the existing city. Rounded junction approaches
 * share one centreline with physics, AI, kerbs, minimaps and vegetation masks. */
export function roundRaceCourse(raw, roadWidths) {
  const points=[],widths=[],turns=[];
  const add=(p,w)=>{
    const previous=points.at(-1);if(previous&&Math.hypot(previous[0]-p[0],previous[1]-p[1])<.01)return;
    const available=Math.max(6,2*(buildingClearance(...p)-.85));
    points.push(p);widths.push(Math.max(6,Math.min(18,w+3,available)));
  };
  for(let i=0;i<raw.length;i++) {
    const p=raw[i],a=raw[(i+raw.length-1)%raw.length],b=raw[(i+1)%raw.length];
    const li=Math.hypot(p[0]-a[0],p[1]-a[1]),lo=Math.hypot(b[0]-p[0],b[1]-p[1]);
    const incoming=[(p[0]-a[0])/li,(p[1]-a[1])/li],outgoing=[(b[0]-p[0])/lo,(b[1]-p[1])/lo];
    const angle=Math.acos(Math.max(-1,Math.min(1,incoming[0]*outgoing[0]+incoming[1]*outgoing[1])));
    const width=Math.min(roadWidths[i],roadWidths[(i+raw.length-1)%raw.length]);
    if(angle<.12||angle>2.8){add([...p],width);continue;}
    let trim=Math.min(18,li*.42,lo*.42),curve=[];
    for(let attempt=0;attempt<7;attempt++) {
      const entry=[p[0]-incoming[0]*trim,p[1]-incoming[1]*trim],exit=[p[0]+outgoing[0]*trim,p[1]+outgoing[1]*trim];
      const steps=Math.max(4,Math.ceil(trim*1.1));
      curve=Array.from({length:steps+1},(_,j)=>{const t=j/steps,u=1-t;return [u*u*entry[0]+2*u*t*p[0]+t*t*exit[0],u*u*entry[1]+2*u*t*p[1]+t*t*exit[1]];});
      if(curve.every(q=>buildingClearance(...q)>=Math.min(4.4,buildingClearance(...p))))break;
      trim*=.65;
    }
    for(const q of curve)add(q,width);
    turns.push({x:p[0],z:p[1],trim,angle});
  }
  return {points,widths,turns};
}
