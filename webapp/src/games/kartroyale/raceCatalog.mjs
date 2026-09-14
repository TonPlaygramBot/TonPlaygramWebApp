import {combineMappedLoops,resampleCircuit,routeLength} from './grandRouteCore.mjs';
import { buildingClearance, waterClearance, courseClearance, courseRoadSurface, roundRaceCourse } from './raceCourse.mjs';
import {widenPassingSections} from './passingClearance.mjs';
import {RACING_CLEARANCE_VERSION} from './racingDimensions.mjs';
import {circuitSides} from './trackEdges.mjs';
import { WORLD } from '../tiranastreets/shared/world.mjs';
/** Pre-authored source-backed routes. Browser and server use identical geometry. */
export function buildRaceCatalog(legacy,routes,districtRoutes=[],ruralRoutes=[]){
 const diagnostics=[],cache=new Map();
 // District extensions retain the six map/save IDs and the shared street graph.
 // Build once per revision; geometry never changes during a running race.
 const edgeKey=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
 const roads=new Map(WORLD.roads.map(r=>[edgeKey(r.a,r.b),r.w]));
 const widthsFor=route=>route.points.map((p,i)=>{
    const width=roads.get(edgeKey(p,route.points[(i+1)%route.points.length]));
    if(!width)throw Error('Race route left the shared Tirana street network');
    return width;
  });
 const tracks=legacy.TRACKS.map(old=>{
  const route=districtRoutes.find(r=>r.id===old.id)||routes.find(r=>r.id===old.id);
  if(!route)throw Error('Missing Tirana city circuit: '+old.id);
  const widths=widthsFor(route);
  return {...old,...route,widths,width:Math.max(...widths),roadFeelVersion:1,mapVersion:'tirana-district-racing-v2'};
 });
 const grand=districtRoutes.find(r=>r.id==='lana-pyramid-grand')||combineMappedLoops(routes.find(r=>r.id==='lana'),routes.find(r=>r.id==='pyramid'));
 if(grand)tracks.push({...legacy.TRACKS.find(t=>t.id==='lana'),...grand,
  widths:widthsFor(grand),
  width:10,roadFeelVersion:1,mapVersion:'tirana-district-racing-v2',name:'Lana–Pyramid · Classic Grand'});
 tracks.push(...ruralRoutes);
 return {tracks,cups:[...legacy.CUPS,...tracks.filter(t=>t.id.endsWith('-grand')).map(t=>({name:t.name+' Cup',track:t.id,difficulty:'street',target:2,reward:500}))],diagnostics,
  makeTrack(id='skanderbeg'){
   if(typeof id!=='string')throw Error('Choose a valid circuit');
   id=legacy.normalizeTrack(id);
   const config=tracks.find(t=>t.id===id);
   if(!config && id.endsWith('-grand'))throw Error('This unvalidated Grand variant is unavailable. Choose a listed circuit.');
   if(!config)throw Error('This circuit is unavailable. Choose a listed circuit.');
   if(cache.has(id))return cache.get(id);
   // Metre-based sampling retains every source corner and four sequential gates.
   const sourceWidths=widthsFor(config),roadSurface=courseRoadSurface(config.points,sourceWidths);
   const course=roundRaceCourse(config.points,sourceWidths,roadSurface);
   const count=Math.max(360,Math.ceil(Math.max(routeLength(course.points)/4,course.points.length)/4)*4);
   const samples=resampleCircuit(course.points,count,course.widths);
   // Leave space for the outer tyre barriers, then taper width changes so the
   // rendered edges and collision corridor stay predictable through junctions.
   samples.points.forEach(p=>{p.width=Math.min(p.width,Math.max(.5,2*(buildingClearance(p.x,p.z)-1.6)));});
   // A short shore section may narrow to one kart lane; never pave the lake.
   if(config.terrainMode)samples.points.forEach(p=>{p.width=Math.min(p.width,Math.max(4.8,2*(Math.min(waterClearance(p.x,p.z)-.5,buildingClearance(p.x,p.z)-1.8))));});
   for(let pass=0;pass<3;pass++)for(const direction of [1,-1])for(let j=0;j<count;j++){
    const i=direction===1?j:count-1-j,p=samples.points[i],q=samples.points[(i+direction+count)%count];
    p.width=Math.min(p.width,q.width+Math.hypot(p.x-q.x,p.z-q.z)*.35);
   }
   // The joined rendered edges must remain inside the original road asphalt,
   // including the miter at each turn. Narrow only where a join needs room.
   for(let pass=0;pass<32;pass++){
    const sides=circuitSides(samples.points,config.width/2),narrow=new Set();
    for(const side of ['left','right'])for(let i=0;i<count;i++){
      const p=sides[side][i];if(!roadSurface.contains(p.x,p.z))narrow.add(i);
    }
    for(const side of ['left','right'])for(let i=0;i<count;i++){
      if(narrow.has(i)||narrow.has((i+1)%count))continue;
      const a=sides[side][i],b=sides[side][(i+1)%count];
      for(const t of [.25,.5,.75])if(!roadSurface.contains(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)){narrow.add(i);narrow.add((i+1)%count);break;}
    }
    if(!narrow.size)break;
    for(const i of narrow)samples.points[i].width*=.95;
   }
   if(config.terrainMode)for(let pass=0;pass<12;pass++){
    const sides=circuitSides(samples.points,config.width/2),narrow=new Set();
    for(const side of ['left','right'])for(let i=0;i<count;i++){
      const a=sides[side][i],b=sides[side][(i+1)%count];
      for(const t of [0,.25,.5,.75])if(courseClearance(config,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)<.3){narrow.add(i);narrow.add((i+1)%count);break;}
    }
    if(!narrow.size)break;
    for(const i of narrow)samples.points[i].width=Math.min(samples.points[i].width,Math.max(2.1,samples.points[i].width*.9));
   }
   const xs=samples.points.map(p=>p.x),zs=samples.points.map(p=>p.z);
   const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
   const track={...config,...samples,width:Math.max(...samples.points.map(p=>p.width)),turns:course.turns,bounds,center:{x:(bounds[0]+bounds[2])/2,z:(bounds[1]+bounds[3])/2},x:(bounds[2]-bounds[0])/2,z:(bounds[3]-bounds[1])/2,bend:0};
   // Event-only shoulder widening: city coordinates/buildings stay untouched.
   // Insufficient building or shoreline clearance is reported, never bulldozed.
   track.passingAudit=widenPassingSections(track,{
    clearance:(x,z)=>Math.min(buildingClearance(x,z)-1.8,waterClearance(x,z)-.5),
    sides:points=>circuitSides(points,track.width/2)
   });
   track.mapVersion=RACING_CLEARANCE_VERSION;
   if(track.passingAudit.unresolved.length)diagnostics.push({id,kind:'passing-clearance',...track.passingAudit});
   cache.set(id,track);return track;
  }};
}
