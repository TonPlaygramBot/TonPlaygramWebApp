// Old geometry/IDs remain in the exact preserved implementation for live rooms.
export * from './legacySimulation.mjs';
import * as legacy from './legacySimulation.mjs';
import {WORLD} from '../tiranastreets/shared/world.mjs';
import {TIRANA_ROUTES} from './tirana-routes.mjs';
import {roadGraph,extendMappedRoute,resampleCircuit,combineMappedLoops} from './grandRouteCore.mjs';
const graph=roadGraph(WORLD.roads),extra=[],cache=new Map();
const register=(next,old)=>{const samples=resampleCircuit(next.points),xs=samples.points.map(p=>p.x),zs=samples.points.map(p=>p.z),bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];const config={...old,...next,name:`${old.name} · Grand`,...samples,bounds,center:{x:(bounds[0]+bounds[2])/2,z:(bounds[1]+bounds[3])/2},x:(bounds[2]-bounds[0])/2,z:(bounds[3]-bounds[1])/2,bend:0};cache.set(next.id,config);extra.push(config);};
export const GRAND_ROUTE_DIAGNOSTICS=[];
for(const route of TIRANA_ROUTES){
  try{const next=extendMappedRoute(route,graph);if(!next){GRAND_ROUTE_DIAGNOSTICS.push(`${route.id}: no eligible longer closed corridor`);continue;}
    register(next,legacy.TRACKS.find(t=>t.id===route.id));
  }catch(e){GRAND_ROUTE_DIAGNOSTICS.push(`${route.id}: ${e.message}`);}
}
const combined=combineMappedLoops(TIRANA_ROUTES.find(r=>r.id==='lana'),TIRANA_ROUTES.find(r=>r.id==='pyramid'));
if(combined){register({...combined,width:10}, {...legacy.TRACKS.find(t=>t.id==='lana'),name:'Lana–Pyramid'});}
else GRAND_ROUTE_DIAGNOSTICS.push('Lana–Pyramid source corridors no longer form one closed perimeter');
export const TRACKS=[...legacy.TRACKS,...extra];
// Keep new cup indices stable even if a future map exposes different detours.
export const CUPS=[...legacy.CUPS,...extra.filter(t=>t.id==='lana-pyramid-grand').map(t=>({name:`${t.name} Cup`,track:t.id,difficulty:'street',target:2,reward:500}))];
export function makeTrack(id='skanderbeg'){if(id.endsWith('-grand')&&!cache.has(id))throw Error('Grand circuit unavailable in the current map');return cache.get(id)||legacy.makeTrack(id);}
