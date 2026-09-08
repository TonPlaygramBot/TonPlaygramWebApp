// Source-review geometry only. No snapping, repair, smoothing or invented vertices.
const EPS = 1e-7;
const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between = (v,a,b) => v >= Math.min(a,b)-EPS && v <= Math.max(a,b)+EPS;
const onSegment = (p,a,b) => Math.abs(cross(a,b,p))<=EPS && between(p[0],a[0],b[0]) && between(p[1],a[1],b[1]);
function intersects(a,b,c,d) {
 if(Math.max(a[0],b[0])+EPS<Math.min(c[0],d[0]) || Math.max(c[0],d[0])+EPS<Math.min(a[0],b[0]) || Math.max(a[1],b[1])+EPS<Math.min(c[1],d[1]) || Math.max(c[1],d[1])+EPS<Math.min(a[1],b[1])) return false;
 const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
 return ((ac>EPS&&ad< -EPS||ac< -EPS&&ad>EPS)&&(ca>EPS&&cb< -EPS||ca< -EPS&&cb>EPS)) || onSegment(c,a,b)||onSegment(d,a,b)||onSegment(a,c,d)||onSegment(b,c,d);
}
function containsPoint(p,ring) {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
  const a=ring[j],b=ring[i];
  if(onSegment(p,a,b)) return false;
  if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
 }
 return inside;
}
function edges(ring) {
 return ring.map((a,i)=>{const b=ring[(i+1)%ring.length];return {a,b,i,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0])};});
}
/** Validate a simple, open-list polygon ring; the closing edge is implicit. */
export function validatePolygonRing(ring,label='polygon') {
 if(!Array.isArray(ring)||ring.length<3||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))) throw Error(`Invalid polygon ${label}`);
 if(new Set(ring.map(p=>`${p[0]},${p[1]}`)).size!==ring.length) throw Error(`Degenerate polygon ${label}: repeated coordinate`);
 // Subtract the first vertex to avoid cancellation at large projected offsets.
 const o=ring[0],area=ring.reduce((sum,a,i)=>sum+cross(o,a,ring[(i+1)%ring.length]),0);
 if(!Number.isFinite(area)||Math.abs(area)<=EPS) throw Error(`Degenerate polygon ${label}`);
 const sorted=edges(ring).sort((a,b)=>a.minX-b.minX),active=[];
 for(const e of sorted) {
  for(let k=active.length-1;k>=0;k--) if(active[k].maxX+EPS<e.minX) active.splice(k,1);
  for(const other of active) {
   if(Math.abs(e.i-other.i)===1||Math.abs(e.i-other.i)===ring.length-1) continue;
   if(intersects(e.a,e.b,other.a,other.b)) throw Error(`Self-intersecting polygon ${label}`);
  }
  active.push(e);
 }
 return ring;
}
function boundariesMeet(a,b) {
 const sorted=edges(b).sort((x,y)=>x.minX-y.minX);
 for(const e of edges(a)) for(const other of sorted) {
  if(other.minX>e.maxX+EPS) break;
  if(other.maxX+EPS>=e.minX&&intersects(e.a,e.b,other.a,other.b)) return true;
 }
 return false;
}
/** Every vertex and every edge must be strictly within the owning shoreline. */
export function containsRing(outer,inner) {
 return !boundariesMeet(outer,inner)&&inner.every(p=>containsPoint(p,outer));
}
export function holesOverlap(a,b) {
 return boundariesMeet(a,b)||containsPoint(a[0],b)||containsPoint(b[0],a);
}
