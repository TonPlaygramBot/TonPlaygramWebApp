/** Screen coordinates are north-up: map x goes visually right; map z goes down.
 * No camera rotation is applied to map gestures. Geography is never mutated. */
export const FAVORITES_KEY = 'tpg:tirana:places:v1';
export const MAX_FAVORITES = 50;
export const validPoint = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
export function inBounds(p,b) { return validPoint(p) && p.x>=b[0] && p.z>=b[1] && p.x<=b[2] && p.z<=b[3]; }
export function fitView(bounds,aspect=1) {
  if (!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[2]<=bounds[0]||bounds[3]<=bounds[1]||!Number.isFinite(aspect)||!(aspect>0)) throw Error('Invalid map bounds');
  const w=Math.max(bounds[2]-bounds[0],(bounds[3]-bounds[1])*aspect)*1.05;
  return {x:(bounds[0]+bounds[2]-w)/2,z:(bounds[1]+bounds[3]-w/aspect)/2,w,h:w/aspect};
}
export function constrainView(view,bounds) {
  if(![view.x,view.z,view.w,view.h].every(Number.isFinite)||view.w<=0||view.h<=0)throw Error('Invalid map view');
  const max=fitView(bounds,view.w/view.h),w=clamp(view.w,40,max.w),h=w*view.h/view.w;
  const x=w>bounds[2]-bounds[0]?(bounds[0]+bounds[2]-w)/2:clamp(view.x,bounds[0],bounds[2]-w);
  const z=h>bounds[3]-bounds[1]?(bounds[1]+bounds[3]-h)/2:clamp(view.z,bounds[1],bounds[3]-h);
  return {x,z,w,h};
}
export function zoomView(view,factor,anchor,bounds) {
  if(!(factor>0)||!Number.isFinite(factor)||!validPoint(anchor)) return view;
  const max=fitView(bounds,view.w/view.h).w,w=clamp(view.w/factor,40,max),ratio=w/view.w;
  return constrainView({x:anchor.x-(anchor.x-view.x)*ratio,z:anchor.z-(anchor.z-view.z)*ratio,w,h:view.h*ratio},bounds);
}
export function screenPoint(view,client,rect) {
  if(!(rect.width>0)||!(rect.height>0))throw Error('Map viewport has no area');
  return {x:view.x+(client.x-rect.left)/rect.width*view.w,z:view.z+(client.y-rect.top)/rect.height*view.h};
}
export function panView(view,dx,dy,width,height,bounds) {
  if(![dx,dy,width,height].every(Number.isFinite)||width<=0||height<=0)return view;
  return constrainView({...view,x:view.x-dx/width*view.w,z:view.z-dy/height*view.h},bounds);
}
export function toGeo(world,p) {
  return {latitude:world.origin[0]-p.z/111320,longitude:world.origin[1]+p.x/(111320*Math.cos(world.origin[0]*Math.PI/180))};
}
export function fromGeo(world,p) {
  return {x:(p.longitude-world.origin[1])*111320*Math.cos(world.origin[0]*Math.PI/180),z:(world.origin[0]-p.latitude)*111320};
}
export function readFavorites(storage,world) {
  try {
    const data=JSON.parse(storage?.getItem(FAVORITES_KEY)||'null');
    if(data?.version!==1||!Array.isArray(data.places)) return [];
    const ids=new Set();
    return data.places.filter(p=>{
      if(!p||typeof p.id!=='string'||!p.id.trim()||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||!Number.isFinite(p.latitude)||Math.abs(p.latitude)>90||!Number.isFinite(p.longitude)||Math.abs(p.longitude)>180) return false;
      ids.add(p.id); return true;
    }).slice(0,MAX_FAVORITES).map(p=>({...p,...fromGeo(world,p),available:inBounds(fromGeo(world,p),world.bounds)}));
  } catch { return []; }
}
export function writeFavorites(storage,places,world) {
  const ids=new Set();
  const safe=places.filter(p=>{
    if(typeof p?.id!=='string'||!p.id.trim()||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||!validPoint(p))return false;
    ids.add(p.id);return true;
  }).slice(0,MAX_FAVORITES).map(p=>({id:p.id,name:p.name.trim().slice(0,80),...toGeo(world,p)}));
  try { if(!storage) throw Error('unavailable'); storage.setItem(FAVORITES_KEY,JSON.stringify({version:1,places:safe})); return true; } catch { return false; }
}
function nearestOnSegment(p,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,0,1):0;
  const point={x:a.x+dx*t,z:a.z+dz*t};
  return {...point,t,distance:Math.hypot(point.x-p.x,point.z-p.z)};
}
export function buildMapGraph(world,mode='walk') {
  if(!['walk','drive'].includes(mode)) throw Error('Unknown routing mode');
  const nodes=[],edges=[],adj=[],lookup=new Map();
  const node=(p,key)=>{if(!lookup.has(key)){lookup.set(key,nodes.length);nodes.push({x:p[0],z:p[1]});adj.push([]);}return lookup.get(key);};
  const edge=(a,b,oneway=0)=>{
    const length=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z);
    if(length<.001)return;
    const id=edges.length;edges.push({a,b,length,oneway});
    if(oneway!==-1)adj[a].push({to:b,length,edge:id});
    if(oneway!==1)adj[b].push({to:a,length,edge:id});
  };
  if(mode==='drive' && world.graph?.nodes?.length){
    world.graph.nodes.forEach((p,i)=>node(p,String(i)));
    for(const [a,b] of world.graph.edges) if(nodes[a]&&nodes[b])edge(a,b);
  } else {
    for(const r of world.roads){
      if(mode==='drive'&&r.walk||r.access==='private'||r.access==='no')continue;
      if(mode==='walk'&&['motorway','motorway_link'].includes(r.highway))continue;
      // Shared node IDs, when available, join bridge approaches correctly.
      // Without them only equal stored endpoints connect: no crossing shortcuts.
      const a=node(r.a,r.nodeA?String(r.nodeA):`${r.a[0]}:${r.a[1]}:${r.layer||0}`);
      const b=node(r.b,r.nodeB?String(r.nodeB):`${r.b[0]}:${r.b[1]}:${r.layer||0}`);
      edge(a,b,mode==='drive'?(r.oneway===-1?-1:r.oneway===true||r.oneway===1?1:0):0);
    }
  }
  return {nodes,edges,adj,mode,bounds:world.bounds};
}
class Heap {
  data=[];
  push(item){let i=this.data.push(item)-1;while(i){const p=(i-1)>>1;if(this.data[p].cost<=item.cost)break;this.data[i]=this.data[p];i=p;}this.data[i]=item;}
  pop(){const top=this.data[0],last=this.data.pop();if(this.data.length){let i=0;while(2*i+1<this.data.length){let n=2*i+1;if(n+1<this.data.length&&this.data[n+1].cost<this.data[n].cost)n++;if(this.data[n].cost>=last.cost)break;this.data[i]=this.data[n];i=n;}this.data[i]=last;}return top;}
}
export function findMapRoute(graph,start,target) {
  const fail=message=>({points:[],distance:0,message,reachable:false,accessDistance:0});
  if(!validPoint(start)||!validPoint(target)||!inBounds(target,graph.bounds))return fail('This place is outside the playable map.');
  if(!graph.edges.length)return fail('No mapped route is available.');
  const snap=p=>{let best;for(let i=0;i<graph.edges.length;i++){const e=graph.edges[i],s=nearestOnSegment(p,graph.nodes[e.a],graph.nodes[e.b]);if(!best||s.distance<best.distance)best={...s,edge:i};}return best;};
  const s=snap(start),t=snap(target),limit=graph.mode==='drive'?90:55;
  if(s.distance>limit||t.distance>limit)return fail('No nearby mapped access. Pick a road or path beside this place.');
  const se=graph.edges[s.edge],te=graph.edges[t.edge],n=graph.nodes.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),heap=new Heap();
  const seed=(i,c)=>{if(c<dist[i]){dist[i]=c;prev[i]=-2;heap.push({i,cost:c});}};
  if(se.oneway!==1)seed(se.a,s.t*se.length);
  if(se.oneway!==-1)seed(se.b,(1-s.t)*se.length);
  const ends=[];
  if(te.oneway!==-1)ends.push([te.a,t.t*te.length]);
  if(te.oneway!==1)ends.push([te.b,(1-t.t)*te.length]);
  let best=Infinity,end=-1,direct=false;
  if(s.edge===t.edge&&((t.t>=s.t&&se.oneway!==-1)||(t.t<=s.t&&se.oneway!==1))){best=Math.abs(t.t-s.t)*se.length;direct=true;}
  while(heap.data.length){const cur=heap.pop();if(cur.cost!==dist[cur.i])continue;if(cur.cost>best)break;
    for(const [i,tail] of ends)if(cur.i===i&&cur.cost+tail<best){best=cur.cost+tail;end=i;direct=false;}
    for(const e of graph.adj[cur.i]){const cost=cur.cost+e.length;if(cost<dist[e.to]&&cost<best){dist[e.to]=cost;prev[e.to]=cur.i;heap.push({i:e.to,cost});}}
  }
  if(!Number.isFinite(best))return fail('These points are not connected by mapped roads or paths.');
  const points=[];
  if(!direct){let i=end,guard=0;while(i>=0&&guard++<=n){points.push(graph.nodes[i]);i=prev[i];}points.reverse();}
  points.unshift({x:s.x,z:s.z});points.push({x:t.x,z:t.z});
  const clean=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>.01);
  return {points:clean,distance:best,reachable:true,accessDistance:t.distance,
    message:t.distance>4?`Route ends ${Math.round(t.distance)} m from the pin at mapped access.`:best<5?'At the mapped destination.':`${Math.round(best)} m on mapped ${graph.mode==='drive'?'roads':'roads and paths'}.`};
}
