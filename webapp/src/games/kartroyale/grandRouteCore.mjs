const pointKey=p=>`${p[0]},${p[1]}`;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const routeLength=points=>points.reduce((sum,p,i)=>sum+dist(p,points[(i+1)%points.length]),0);
function heapPush(h,v){h.push(v);let i=h.length-1;while(i){const p=(i-1)>>1;if(h[p][0]<=v[0])break;h[i]=h[p];i=p;}h[i]=v;}
function heapPop(h){const first=h[0],last=h.pop();if(h.length){let i=0;while(i*2+1<h.length){let j=i*2+1;if(j+1<h.length&&h[j+1][0]<h[j][0])j++;if(h[j][0]>=last[0])break;h[i]=h[j];i=j;}h[i]=last;}return first;}
export function roadGraph(roads){
  const nodes=new Map(),edges=new Map();
  for(const r of roads){if(r.walk||r.tunnel||r.construction||r.proposed||['no','private'].includes(r.access)||['no','private'].includes(r.motorVehicle)||['construction','proposed','abandoned','footway','cycleway','steps'].includes(r.highway)||!Number.isFinite(r.w)||r.w<6||![r.a,r.b].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||dist(r.a,r.b)<.01)continue;
    const a=pointKey(r.a),b=pointKey(r.b);for(const [k,p] of [[a,r.a],[b,r.b]]){if(!nodes.has(k))nodes.set(k,[...p]);if(!edges.has(k))edges.set(k,new Map());}
    const cost=dist(r.a,r.b),old=edges.get(a).get(b);if(!old||r.w>old.width){const e={cost,width:r.w,name:r.name||''};edges.get(a).set(b,e);edges.get(b).set(a,e);}
  }
  return {nodes,edges};
}
function path(graph,a,b,blocked){
  if(!graph.nodes.has(a)||!graph.nodes.has(b))return null;
  const heap=[],cost=new Map([[a,0]]),prev=new Map();heapPush(heap,[0,a]);
  while(heap.length){const [d,u]=heapPop(heap);if(d!==cost.get(u))continue;if(u===b){const out=[b];while(out.at(-1)!==a)out.push(prev.get(out.at(-1)));return out.reverse();}
    for(const [v,e] of graph.edges.get(u)||[]){if(blocked.has(v)&&v!==b)continue;const nd=d+e.cost;if(nd<(cost.get(v)??Infinity)){cost.set(v,nd);prev.set(v,u);heapPush(heap,[nd,v]);}}
  }return null;
}
/** Find an exterior detour using actual connected road edges. New closed-race
 * IDs only: old circuits/saves stay immutable. Never scale the geographic city. */
export function extendMappedRoute(route,graph,{ratio=1.4,maxRatio=2.6,candidates=20,maxLength=2200}={}){
  const raw=route.points;if(!Array.isArray(raw)||raw.length<4)return null;
  const originalLength=routeLength(raw),originalKeys=raw.map(pointKey),originalSet=new Set(originalKeys);let best=null;
  for(const fraction of [.25,.5,.75]){
    const ai=0,bi=Math.floor(raw.length*fraction),a=originalKeys[ai],b=originalKeys[bi];
    const blocked=new Set(originalKeys);blocked.delete(a);blocked.delete(b);
    const mid=[(raw[0][0]+raw[bi][0])/2,(raw[0][1]+raw[bi][1])/2];
    const waypoints=[...graph.nodes].filter(([k,p])=>!originalSet.has(k)&&dist(p,mid)>100).sort((u,v)=>dist(v[1],mid)-dist(u[1],mid)||u[0].localeCompare(v[0]));
    const chosen=Array.from({length:Math.min(candidates,waypoints.length)},(_,i)=>waypoints[Math.floor(i*waypoints.length/Math.min(candidates,waypoints.length))]);
    for(const [via] of chosen){const first=path(graph,a,via,new Set([...blocked,b]));if(!first)continue;const second=path(graph,via,b,new Set([...blocked,...first.slice(0,-1)]));if(!second)continue;
      const ids=[...first,...second.slice(1),...originalKeys.slice(bi+1)],seen=new Set(ids);if(seen.size!==ids.length)continue;
      const points=ids.map(k=>graph.nodes.get(k));if(points.some(p=>!p))continue;
      let width=10,valid=true;const names=new Set();for(let i=0;i<ids.length;i++){const edge=graph.edges.get(ids[i])?.get(ids[(i+1)%ids.length]);if(!edge){valid=false;break;}width=Math.min(width,edge.width);if(edge.name)names.add(edge.name);}
      if(!valid)continue;const length=routeLength(points);if(length<originalLength*ratio||length>originalLength*maxRatio||length>maxLength)continue;
      if(!best||length>best.length)best={...route,id:`${route.id}-grand`,points:points.map(p=>[...p]),streets:[...names].sort(),width:Math.max(6,Math.min(10,width)),length,originalLength,source:'Connected edges of the checked-in OSM snapshot; authored closed race, not a current legal driving itinerary'};
    }
  }return best;
}
export function resampleCircuit(raw,count=360){
  if(!Array.isArray(raw)||raw.length<3||!Number.isInteger(count)||count<3||raw.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n))))throw Error('Invalid route');
  const corners=raw.filter((p,i)=>{const a=raw[(i+raw.length-1)%raw.length],b=raw[(i+1)%raw.length],cross=(p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]);return Math.abs(cross)>1e-7||dist(a,b)<.01;});
  if(corners.length<3||corners.length>count)throw Error('Circuit needs a higher-resolution simulation; not silently simplified');
  const lengths=corners.map((p,i)=>dist(p,corners[(i+1)%corners.length]));if(lengths.some(n=>n<.001))throw Error('Degenerate circuit');
  const total=lengths.reduce((a,b)=>a+b,0),extra=count-corners.length,alloc=lengths.map(l=>1+Math.floor(extra*l/total));
  let left=count-alloc.reduce((a,b)=>a+b,0);const fractions=lengths.map((l,i)=>({i,f:(extra*l/total)%1})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let i=0;i<left;i++)alloc[fractions[i].i]++;
  let points=corners.flatMap((a,i)=>Array.from({length:alloc[i]},(_,j)=>{const b=corners[(i+1)%corners.length];return {x:a[0]+(b[0]-a[0])*j/alloc[i],z:a[1]+(b[1]-a[1])*j/alloc[i]};}));
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),index=i=>((i%count)+count)%count;let start=0,score=Infinity;
  for(let i=0;i<count;i++){let s=0;for(let k=-16;k<12;k++){const a=points[index(i+k)],b=points[index(i+k+1)],c=points[index(i+k+2)];s+=Math.abs(wrap(Math.atan2(c.x-b.x,c.z-b.z)-Math.atan2(b.x-a.x,b.z-a.z)));}if(s<score){score=s;start=i;}}
  points=points.slice(start).concat(points.slice(0,start));let distance=0;points.forEach((p,i)=>{const q=points[(i+1)%count];p.yaw=Math.atan2(q.x-p.x,q.z-p.z);p.distance=distance;distance+=Math.hypot(q.x-p.x,q.z-p.z);});return {points,length:distance};
}
/** Join adjacent existing race loops by removing their shared corridor.
 * Every returned edge is copied from a shipped route; no connector is invented. */
export function combineMappedLoops(first,second){
  if([first,second].some(r=>!Array.isArray(r?.points)||r.points.length<3||r.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)))))return null;
  const edges=new Map(),nodes=new Map();let shared=0;
  for(const route of [first,second])for(let i=0;i<route.points.length;i++){
    const p=route.points[i],q=route.points[(i+1)%route.points.length],a=pointKey(p),b=pointKey(q),key=[a,b].sort().join('|');
    if(a===b)return null;nodes.set(a,[...p]);nodes.set(b,[...q]);
    if(edges.has(key)){edges.delete(key);shared++;}else edges.set(key,[a,b]);
  }
  if(!shared||!edges.size)return null;const graph=new Map();
  for(const [a,b] of edges.values()){if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);graph.get(a).push(b);graph.get(b).push(a);}
  if([...graph.values()].some(v=>v.length!==2))return null;
  const start=[...graph.keys()].sort()[0],ids=[start];let prev='',current=start;
  do {const next=graph.get(current).find(n=>n!==prev);if(next===start)break;if(ids.includes(next))return null;ids.push(next);prev=current;current=next;}while(ids.length<=edges.size);
  if(ids.length!==edges.size)return null;const points=ids.map(k=>nodes.get(k));
  return {id:`${first.id}-${second.id}-grand`,points,streets:[...new Set([...(first.streets||[]),...(second.streets||[])])],length:routeLength(points),source:'Combined shipped mapped race corridors; authored closed-event route'};
}
