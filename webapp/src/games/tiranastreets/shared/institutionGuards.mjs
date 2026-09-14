import {CITY_PLACES} from '../../tirana-city-source/registry.mjs';
import {CITY_SOURCE} from '../../tirana-city-source/sourceData.mjs';
import {frontage,segmentDistance,facadeEdges} from '../../tirana-city-source/sourceCore.mjs';
import {spatialIndex} from '../../tirana-city-completion/placementCore.mjs';
import {forceWeaponFor} from './uploadedWeapons.mjs';
const layouts=new WeakMap();
const roadIndexes=new WeakMap();
function guardRoadIndex(roads) {
  let near=roadIndexes.get(roads);
  if(near)return near;
  const bounded=[],unbounded=[];
  for(const road of roads){
    if(road.walk)continue;
    const margin=road.w/2+.55;
    const bounds=[Math.min(road.a[0],road.b[0])-margin,Math.min(road.a[1],road.b[1])-margin,
      Math.max(road.a[0],road.b[0])+margin,Math.max(road.a[1],road.b[1])+margin];
    if(bounds.every(Number.isFinite))bounded.push({road,bounds});else unbounded.push(road);
  }
  const indexed=spatialIndex(bounded,record=>record.bounds,80);
  // Full segment bounds plus the collision margin also cover wide roads and
  // endpoints across cell edges. The original distance test remains decisive.
  near=(x,z)=>[...indexed(x,z).map(record=>record.road),...unbounded];
  roadIndexes.set(roads,near);
  return near;
}
const copyGuards=guards=>guards.map(n=>({...n,guardPost:{...n.guardPost}}));
// Authored GAME difficulty tiers, not real security staffing or guard positions.
export function institutionTier(site) {
  if(!['government','police','embassy'].includes(site.category))return 0;
  if(/noter|downtown|service office/i.test(site.name||''))return 0;
  if(/kuvendi|president|kryeministri|banka e shqip/i.test(site.name||''))return 3;
  return site.category==='embassy'||site.category==='police'||/\bministr|gjykat|prokuror/i.test(site.name||'')?2:1;
}
export function createInstitutionGuards(world,env,sites=CITY_PLACES.sites) {
  const saved=layouts.get(world)?.get(env.collide);
  if(saved?.sites===sites)return copyGuards(saved.guards);
  const guards=[],seen=new Set();
  const nearbyRoads=guardRoadIndex(world.roads);
  for(const site of sites){
    const tier=institutionTier(site);if(!tier)continue;
    const key=site.name?.trim()||site.buildingId;if(seen.has(key))continue;
    const edge=frontage(site,world.roads,CITY_SOURCE.entrances);if(!edge)continue;
    const candidates=[edge,...facadeEdges(site.footprint||[]).filter(e=>e.length>2).sort((a,b)=>b.length-a.length)];
    const count=[0,2,4,6][tier];
    for(let i=0;i<count;i++){
      const side=i%2?1:-1,rank=Math.floor(i/2);
      let post,postEdge=edge;
      search: for(const e of candidates)for(const offset of [1.2,2,3.2,4.4,6,8]){
        const u=Math.max(.6,Math.min(e.length-.6,e.length/2+side*(2+rank*1.5)));
        const candidate={x:e.a[0]+e.ux*u+e.nx*offset,z:e.a[1]+e.uz*u+e.nz*offset};
        const clear={...candidate};env.collide(clear,.45);
        if(Math.hypot(clear.x-candidate.x,clear.z-candidate.z)>.15)continue;
        if(nearbyRoads(clear.x,clear.z).some(r=>segmentDistance(clear.x,clear.z,r.a,r.b)<r.w/2+.55))continue;
        if(guards.some(n=>Math.hypot(n.x-clear.x,n.z-clear.z)<.95))continue;
        post=clear;postEdge=e;break search;
      }
      if(!post)continue;
      const forceCharacter=tier===3&&i>=2?'shqiponja_officer':'patrol_officer';
      guards.push({...post,id:`institution-${site.buildingId}-${i}`,kind:'police',role:'institution-guard',
        institution:site.buildingId,securityTier:tier,guardPost:{...post,heading:Math.atan2(-postEdge.nx,-postEdge.nz)},
        forceCharacter,weapon:forceWeaponFor(forceCharacter,i),motion:'idle',anim:'idle',heading:Math.atan2(-postEdge.nx,-postEdge.nz),
        speed:0,health:100,nextShot:0,downUntil:0,panicUntil:0});
    }
    if(guards.some(n=>n.institution===site.buildingId))seen.add(key);
  }
  if(!layouts.has(world))layouts.set(world,new Map());
  layouts.get(world).set(env.collide,{sites,guards:copyGuards(guards)});
  return guards;
}
