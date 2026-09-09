import {combineMappedLoops,resampleCircuit} from './grandRouteCore.mjs';
/** Small deterministic startup catalog. Optional route searches belong in an
 * offline authoring tool, never the main thread before the garage opens. */
export function buildRaceCatalog(legacy, routes) {
  const diagnostics=[],extra=[],cache=new Map();
  try {
    const route=combineMappedLoops(routes.find(r=>r.id==='lana'),routes.find(r=>r.id==='pyramid'));
    if (!route) throw Error('source corridors do not form a closed perimeter');
    const old=legacy.TRACKS.find(t=>t.id==='lana');
    if (!old) throw Error('Lana source configuration unavailable');
    const samples=resampleCircuit(route.points);
    const xs=samples.points.map(p=>p.x),zs=samples.points.map(p=>p.z);
    const bounds=[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)];
    const config={...old,...route,...samples,width:10,name:'Lana–Pyramid · Grand',bounds,
      center:{x:(bounds[0]+bounds[2])/2,z:(bounds[1]+bounds[3])/2},
      x:(bounds[2]-bounds[0])/2,z:(bounds[3]-bounds[1])/2,bend:0};
    extra.push(config);cache.set(config.id,config);
  } catch (e) { diagnostics.push(`Grand unavailable: ${e instanceof Error ? e.message : String(e)}`); }
  return {tracks:[...legacy.TRACKS,...extra],
    cups:[...legacy.CUPS,...extra.map(t=>({name:`${t.name} Cup`,track:t.id,difficulty:'street',target:2,reward:500}))],
    diagnostics, makeTrack(id='skanderbeg') {
      if (typeof id !== 'string') throw Error('Choose a valid circuit');
      if (cache.has(id)) return cache.get(id);
      if (id.endsWith('-grand')) throw Error('This unvalidated Grand variant is unavailable. Choose a listed circuit.');
      return legacy.makeTrack(id);
    }};
}
