// Offline route authoring. Source coordinates and carriageway widths stay in
// metres; no graph search runs during gameplay. © OpenStreetMap contributors.
import {writeFile} from 'node:fs/promises';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {roadGraph,routeLength} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {buildRaceCatalog} from '../webapp/src/games/kartroyale/raceCatalog.mjs';
import {tyreBarrierLayout} from '../webapp/src/games/kartroyale/tyreBarrierCore.mjs';
import {MAIN_ROAD_ROUTES} from '../webapp/src/games/kartroyale/main-road-routes.mjs';
import {DISTRICT_ROUTES} from '../webapp/src/games/kartroyale/district-routes.mjs';
import {parallelRoadOverlap} from '../webapp/src/games/kartroyale/raceRouteAudit.mjs';

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const districts=[
  ['skanderbeg',[0,0],2500],['blloku',[-150,750],2400],
  ['lana',[250,360],2600],['pyramid',[210,570],2100],
  ['stadium',[220,830],2800],['lana-pyramid-grand',[100,600],3400]
];
function push(h,v){h.push(v);let i=h.length-1;while(i){const p=(i-1)>>1;if(h[p][0]<=v[0])break;h[i]=h[p];i=p;}h[i]=v;}
function pop(h){const first=h[0],last=h.pop();if(h.length){let i=0;while(i*2+1<h.length){let j=i*2+1;if(j+1<h.length&&h[j+1][0]<h[j][0])j++;if(h[j][0]>=last[0])break;h[i]=h[j];i=j;}h[i]=last;}return first;}
function path(graph,a,b,blocked){
  const heap=[],cost=new Map([[a,0]]),previous=new Map();push(heap,[0,a]);
  while(heap.length){const [d,u]=pop(heap);if(d!==cost.get(u))continue;
    if(u===b){const out=[b];while(out.at(-1)!==a)out.push(previous.get(out.at(-1)));return out.reverse();}
    for(const [v,e] of graph.edges.get(u)||[]){if(blocked.has(v)&&v!==b)continue;
      // Strongly prefer broad boulevards; use narrow connectors only where
      // the checked-in street graph cannot form a neighborhood loop without them.
      const next=d+e.cost*(e.width>=9?1:4.5);
      if(next<(cost.get(v)??Infinity)){cost.set(v,next);previous.set(v,u);push(heap,[next,v]);}
    }
  }return null;
}
const main=WORLD.roads.filter(r=>!r.walk&&r.w>=6.2&&[r.a,r.b].every(p=>distance(p,[0,600])<2800));
const clear=main.filter(r=>{
  const n=Math.max(1,Math.ceil(distance(r.a,r.b)/2));
  // Reserve kart lanes and barrier clearance at every point, not just nodes.
  for(let i=0;i<=n;i++)if(buildingClearance(r.a[0]+(r.b[0]-r.a[0])*i/n,r.a[1]+(r.b[1]-r.a[1])*i/n)<4.2)return false;
  return true;
});
const graph=roadGraph(clear),junctions=[...graph.nodes].filter(([id])=>graph.edges.get(id).size>=3);
const nearest=p=>junctions.reduce((a,b)=>distance(a[1],p)<distance(b[1],p)?a:b)[0];
const routes=[],signatures=new Set();
const district=process.argv[2];
if(district&&!districts.some(([id])=>id===district))throw Error('Unknown race district');
for(const [id,center,target] of districts.filter(([id])=>!district||id===district)){
  // When authoring a single district, preserve the other event signatures.
  if(district)for(const route of (await import('../webapp/src/games/kartroyale/main-road-routes.mjs')).MAIN_ROAD_ROUTES)if(route.id!==district)signatures.add(route.points.map(p=>p.join(',')).sort().join('|'));
  let best;
  // Preserve a shipped event when the source graph cannot offer a better
  // separated boulevard loop. Certify its actual asphalt and barriers first.
  const preserved=MAIN_ROAD_ROUTES.find(route=>route.id===id);
  if(preserved){
    const ids=preserved.points.map(p=>p.join(','));
    const edges=ids.map((key,i)=>graph.edges.get(key)?.get(ids[(i+1)%ids.length]));
    if(edges.every(Boolean)){
      const length=routeLength(preserved.points),near=Math.min(...preserved.points.map(p=>distance(p,center)));
      const broadShare=edges.reduce((sum,e)=>sum+(e.width>=9?e.cost:0),0)/length;
      const routeStats={minimumSourceWidth:Math.min(...edges.map(e=>e.width)),broadRoadShare:Number(broadShare.toFixed(4)),averageSourceWidth:Number((edges.reduce((sum,e)=>sum+e.width*e.cost,0)/length).toFixed(2))};
      const score=Math.abs(length-target)*.35+near*.4+(1-broadShare)*6000;
      const candidate={...preserved,length,routeStats};
      const catalog=buildRaceCatalog({TRACKS:[candidate],CUPS:[],normalizeTrack:id=>id},[],[candidate]);
      const track=catalog.makeTrack(id),layout=tyreBarrierLayout(track,buildingClearance);
      if(broadShare>=.75&&near<=240&&!track.passingAudit.unresolved.length&&layout.positions.length>track.length*1.3)
        best={...candidate,score,signature:[...ids].sort().join('|')};
    }
  }
  const starts=junctions.filter(([,p])=>distance(p,center)<750).sort((a,b)=>distance(a[1],center)-distance(b[1],center)).slice(0,30);
  for(const [start] of starts)for(const radius of [250,400,550,700,900,1100,1300])for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,a=nearest([center[0]+Math.cos(angle)*radius,center[1]+Math.sin(angle)*radius]);
    const b=nearest([center[0]+Math.cos(angle+2.2)*radius,center[1]+Math.sin(angle+2.2)*radius]);
    if(new Set([start,a,b]).size!==3)continue;
    const first=path(graph,start,a,new Set([b]));if(!first)continue;
    const second=path(graph,a,b,new Set(first.slice(0,-1)));if(!second)continue;
    const third=path(graph,b,start,new Set([...first.slice(1),...second.slice(0,-1)]));if(!third)continue;
    const ids=[...first,...second.slice(1),...third.slice(1,-1)];
    if(new Set(ids).size!==ids.length)continue;
    const signature=[...ids].sort().join('|');if(signatures.has(signature))continue;
    const points=ids.map(key=>graph.nodes.get(key)),length=routeLength(points);
    if(length<1600||length>4200)continue;
    const near=Math.min(...points.map(p=>distance(p,center)));if(near>240)continue;
    const edges=ids.map((key,i)=>graph.edges.get(key).get(ids[(i+1)%ids.length]));
    const mainLength=edges.reduce((sum,e)=>sum+(e.width>=9?e.cost:0),0);
    const broadShare=mainLength/length;
    if(broadShare<.75)continue;
    const score=Math.abs(length-target)*.35+near*.4+(1-broadShare)*6000;
    const routeStats={minimumSourceWidth:Math.min(...edges.map(e=>e.width)),broadRoadShare:Number(broadShare.toFixed(4)),averageSourceWidth:Number((edges.reduce((sum,e)=>sum+e.width*e.cost,0)/length).toFixed(2))};
    // Paired carriageways must not merge into a single race ribbon.
    // Keep room for the independent tyre walls on either side of every lap.
    if((!best||score<best.score)&&parallelRoadOverlap(points,edges.map(e=>e.width))<.18)best={id,points,streets:[...new Set(edges.map(e=>e.name).filter(Boolean))].sort(),length,originalLength:DISTRICT_ROUTES.find(r=>r.id===id).length,routeStats,score,signature};
  }
  if(!best)throw Error('No continuous main-road circuit for '+id);
  signatures.add(best.signature);delete best.score;delete best.signature;
  routes.push({...best,routeClass:'main-roads'});
  console.log(id,Math.round(best.length)+' m',best.points.length+' source nodes',Math.round(best.routeStats.broadRoadShare*100)+'% broad roads');
}
if(district){
  if(!process.argv[3])throw Error('A single-district run requires an output JSON path');
  await writeFile(process.argv[3],JSON.stringify(routes[0]));
}else await writeFile(new URL('../webapp/src/games/kartroyale/main-road-routes.mjs',import.meta.url),
  '// Main-road closed events, generated by scripts/build-racing-main-roads.mjs.\n'+
  '// Exact connected OSM road edges, source width >= 6.2 m. © OpenStreetMap contributors, ODbL 1.0.\n'+
  'export const MAIN_ROAD_ROUTES = '+JSON.stringify(routes)+';\n');
