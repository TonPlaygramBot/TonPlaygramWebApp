import clipping from 'polygon-clipping';
import { circuitSides } from './trackEdges.mjs';
import { TYRE_EDGE_OFFSET, TYRE_RADIUS } from './roadFeel.mjs';

const CELL = 16;
const cache = new WeakMap();
const cross = (a, b, p) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
const distance = (p,a,b) => {
  const dx=b[0]-a[0],dz=b[1]-a[1],d=dx*dx+dz*dz;
  const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/d)):0;
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
};
const insideTriangle = (p,t) => {
  const signs=[cross(t[0],t[1],p),cross(t[1],t[2],p),cross(t[2],t[0],p)];
  return signs.every(s=>s>=-1e-8)||signs.every(s=>s<=1e-8);
};

/** These are the exact two triangles per segment used by KartRenderer. Taking
 * their union removes the folded inside edges of tight bends and junctions. */
export function trackSurfaceTriangles(track) {
  const {left,right}=circuitSides(track.points,track.width/2),triangles=[];
  const xy=p=>[p.x,p.z];
  for(let i=0;i<left.length;i++) {
    const j=(i+1)%left.length;
    for(const t of [[xy(left[i]),xy(left[j]),xy(right[i])],[xy(right[i]),xy(left[j]),xy(right[j])]])
      if(Math.abs(cross(...t))>1e-9)triangles.push(t);
  }
  return triangles;
}

export function trackSurface(track) {
  if(cache.has(track))return cache.get(track);
  const triangles=trackSurfaceTriangles(track),grid=new Map();
  for(const t of triangles) {
    for(let x=Math.floor(Math.min(...t.map(p=>p[0]))/CELL);x<=Math.floor(Math.max(...t.map(p=>p[0]))/CELL);x++)
      for(let z=Math.floor(Math.min(...t.map(p=>p[1]))/CELL);z<=Math.floor(Math.max(...t.map(p=>p[1]))/CELL);z++) {
        const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);
      }
  }
  // Snap only the boolean operation to millimetres. This prevents coincident
  // triangle edges producing microscopic sweep-line segments; clearance is
  // still measured against the unsnapped rendered triangles above.
  const polygons=clipping.union(...triangles.map(t=>{
    const ring=t.map(p=>p.map(v=>Math.round(v*1000)/1000));return [[...ring,ring[0]]];
  }));
  const result={polygons,triangles,clearance(x,z,limit=2) {
    let best=limit;const p=[x,z],seen=new Set();
    for(let ix=Math.floor((x-limit)/CELL);ix<=Math.floor((x+limit)/CELL);ix++)
      for(let iz=Math.floor((z-limit)/CELL);iz<=Math.floor((z+limit)/CELL);iz++)
        for(const t of grid.get(`${ix},${iz}`)||[]) {
          if(seen.has(t))continue;seen.add(t);
          if(insideTriangle(p,t))return 0;
          for(let i=0;i<3;i++)best=Math.min(best,distance(p,t[i],t[(i+1)%3]));
        }
    return best;
  }};
  cache.set(track,result);return result;
}

/** Polygon-clipping returns CCW exteriors and CW holes. The right-hand normal
 * always points away from asphalt. Round convex corners; join concave ones. */
function offsetBoundary(closed,offset) {
  const ring=closed.slice(0,-1),out=[];
  const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],d=Math.hypot(dx,dz);return [dz/d,-dx/d];};
  for(let i=0;i<ring.length;i++) {
    const p=ring[i],before=normal(ring[(i+ring.length-1)%ring.length],p),after=normal(p,ring[(i+1)%ring.length]);
    const turn=Math.atan2(before[0]*after[1]-before[1]*after[0],before[0]*after[0]+before[1]*after[1]);
    if(turn>1e-5) {
      const angle=Math.atan2(before[1],before[0]),steps=Math.max(1,Math.ceil(turn/.12));
      for(let j=0;j<=steps;j++)out.push([p[0]+Math.cos(angle+turn*j/steps)*offset,p[1]+Math.sin(angle+turn*j/steps)*offset]);
    } else {
      const denominator=1+before[0]*after[0]+before[1]*after[1];
      // Near reversals produce unbounded miters. Their samples would be on a
      // collapsed island, so use a finite join and let footprint checks reject it.
      const scale=offset/Math.max(.25,denominator);
      out.push([p[0]+(before[0]+after[0])*scale,p[1]+(before[1]+after[1])*scale]);
    }
  }
  return out;
}

/** Non-overlapping tyre footprints, outside the complete asphalt union. The
 * optional clearance callback accounts for the shared city's building solids. */
export function tyreBarrierLayout(track,buildingClearance=()=>Infinity) {
  const surface=trackSurface(track),positions=[],occupied=new Map();
  const spacing=TYRE_RADIUS*2+.045,cell=spacing;
  let rejectedRoad=0,rejectedBuilding=0,rejectedOverlap=0;
  for(const polygon of surface.polygons)for(const ring of polygon) {
    const outline=offsetBoundary(ring,TYRE_EDGE_OFFSET),lengths=outline.map((a,i)=>{
      const b=outline[(i+1)%outline.length];return Math.hypot(b[0]-a[0],b[1]-a[1]);
    });
    const length=lengths.reduce((a,b)=>a+b,0),count=Math.floor(length/spacing);
    if(count<3)continue;
    const step=length/count;let segment=0,start=0;
    for(let i=0;i<count;i++) {
      const at=(i+.5)*step;
      while(segment<lengths.length-1&&start+lengths[segment]<at)start+=lengths[segment++];
      const a=outline[segment],b=outline[(segment+1)%outline.length],t=(at-start)/Math.max(1e-9,lengths[segment]);
      const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      if(surface.clearance(x,z)<TYRE_RADIUS+.04){rejectedRoad++;continue;}
      if(buildingClearance(x,z)<TYRE_RADIUS+.04){rejectedBuilding++;continue;}
      const ix=Math.floor(x/cell),iz=Math.floor(z/cell);let overlap=false;
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
        for(const p of occupied.get(`${ix+dx},${iz+dz}`)||[])
          if(Math.hypot(x-p.x,z-p.z)<TYRE_RADIUS*2+.01)overlap=true;
      if(overlap){rejectedOverlap++;continue;}
      const p={x,z,index:i};positions.push(p);
      const key=`${ix},${iz}`;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(p);
    }
  }
  return {positions,rejectedRoad,rejectedBuilding,rejectedOverlap};
}
