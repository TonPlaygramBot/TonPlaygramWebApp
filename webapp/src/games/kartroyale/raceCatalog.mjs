import {combineMappedLoops,resampleCircuit,routeLength} from './grandRouteCore.mjs';
import { buildingClearance, roundRaceCourse } from './raceCourse.mjs';
import { WORLD } from '../tiranastreets/shared/world.mjs';
/** Pre-authored source-backed routes. Browser and server use identical geometry. */
export function buildRaceCatalog(legacy,routes){
 const diagnostics=[],cache=new Map();
 // Compact three-lap events follow existing, connected streets. The full city
 // is unchanged; race duration no longer depends on the 5 km expedition routes.
 const edgeKey=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
 const roads=new Map(WORLD.roads.filter(r=>!r.walk).map(r=>[edgeKey(r.a,r.b),r.w]));
 const tracks=legacy.TRACKS.map(old=>{
  const route=routes.find(r=>r.id===old.id);
  if(!route)throw Error('Missing Tirana city circuit: '+old.id);
  const widths=route.points.map((p,i)=>{
    const width=roads.get(edgeKey(p,route.points[(i+1)%route.points.length]));
    if(!width)throw Error('Race route left the shared Tirana street network');
    return Math.max(6,width);
  });
  return {...old,...route,widths,width:Math.max(...widths),mapVersion:'shared-tirana-streets'};
 });
 const grand=combineMappedLoops(routes.find(r=>r.id==='lana'),routes.find(r=>r.id==='pyramid'));
 if(grand)tracks.push({...legacy.TRACKS.find(t=>t.id==='lana'),...grand,width:10,name:'Lana–Pyramid · Classic Grand'});
 return {tracks,cups:[...legacy.CUPS,...tracks.filter(t=>t.id.endsWith('-grand')).map(t=>({name:t.name+' Cup',track:t.id,difficulty:'street',target:2,reward:500}))],diagnostics,
  makeTrack(id='skanderbeg'){
   if(typeof id!=='string')throw Error('Choose a valid circuit');
   id=legacy.normalizeTrack(id);
   const config=tracks.find(t=>t.id===id);
   if(!config && id.endsWith('-grand'))throw Error('This unvalidated Grand variant is unavailable. Choose a listed circuit.');
   if(!config)throw Error('This circuit is unavailable. Choose a listed circuit.');
   if(cache.has(id))return cache.get(id);
   // Metre-based sampling retains every source corner and four sequential gates.
   const course=roundRaceCourse(config.points,config.widths||config.points.map(()=>config.width));
   const count=Math.max(360,Math.ceil(Math.max(routeLength(course.points)/4,course.points.length)/4)*4);
   const samples=resampleCircuit(course.points,count,course.widths);
   // Leave space for the outer tyre barriers, then taper width changes so the
   // rendered edges and collision corridor stay predictable through junctions.
   samples.points.forEach(p=>{p.width=Math.min(p.width,Math.max(6,2*(buildingClearance(p.x,p.z)-1.6)));});
   for(let pass=0;pass<3;pass++)for(const direction of [1,-1])for(let j=0;j<count;j++){
    const i=direction===1?j:count-1-j,p=samples.points[i],q=samples.points[(i+direction+count)%count];
    p.width=Math.min(p.width,q.width+Math.hypot(p.x-q.x,p.z-q.z)*.35);
   }
   const xs=samples.points.map(p=>p.x),zs=samples.points.map(p=>p.z);
   const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
   const track={...config,...samples,width:Math.max(...course.widths),turns:course.turns,bounds,center:{x:(bounds[0]+bounds[2])/2,z:(bounds[1]+bounds[3])/2},x:(bounds[2]-bounds[0])/2,z:(bounds[3]-bounds[1])/2,bend:0};
   cache.set(id,track);return track;
  }};
}
