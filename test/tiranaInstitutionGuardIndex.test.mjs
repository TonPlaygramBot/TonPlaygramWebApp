import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {frontage,segmentDistance,facadeEdges} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import {spatialIndex} from '../webapp/src/games/tirana-city-completion/placementCore.mjs';
import {containsPoint} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {forceWeaponFor} from '../webapp/src/games/tiranastreets/shared/uploadedWeapons.mjs';

// Keep the pre-index exhaustive implementation as the behavior oracle. Registry
// fixtures isolate this regression from loading the complete mapped city.
const exhaustive = (()=>{
  const CITY_PLACES={sites:[]}, CITY_SOURCE={entrances:[]};
const layouts=new WeakMap();
const copyGuards=guards=>guards.map(n=>({...n,guardPost:{...n.guardPost}}));
// Authored GAME difficulty tiers, not real security staffing or guard positions.
function institutionTier(site) {
  if(!['government','police','embassy'].includes(site.category))return 0;
  if(/noter|downtown|service office/i.test(site.name||''))return 0;
  if(/kuvendi|president|kryeministri|banka e shqip/i.test(site.name||''))return 3;
  return site.category==='embassy'||site.category==='police'||/\bministr|gjykat|prokuror/i.test(site.name||'')?2:1;
}
function createInstitutionGuards(world,env,sites=CITY_PLACES.sites) {
  const saved=layouts.get(world)?.get(env.collide);
  if(saved?.sites===sites)return copyGuards(saved.guards);
  const guards=[],seen=new Set();
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
        if(world.roads.some(r=>!r.walk&&segmentDistance(clear.x,clear.z,r.a,r.b)<r.w/2+.55))continue;
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
  return {createInstitutionGuards,institutionTier};
})();

function load(source){
  const code=source.replace(/^import .*;$/gm,'').replaceAll('export function ','function ');
  return vm.runInNewContext(`(function(){${code};return {createInstitutionGuards,institutionTier};})()`,
    {frontage,segmentDistance,facadeEdges,spatialIndex,forceWeaponFor,CITY_PLACES:{sites:[]},CITY_SOURCE:{entrances:[]}});
}
const indexed=load(readFileSync(new URL('../webapp/src/games/tiranastreets/shared/institutionGuards.mjs',import.meta.url),'utf8'));
const rectangle=(id,x,z,w=18,d=16,category='government')=>({buildingId:id,name:`Institution ${id}`,category,
  footprint:[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]});
const plain=value=>JSON.parse(JSON.stringify(value));
function collideFor(sites){return (point)=>{if(sites.some(site=>containsPoint(point.x,point.z,site.footprint)))point.x+=1;};}

test('road broad phase preserves complete guard layouts, collision choices and order',()=>{
  let seed=91;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
  for(let pass=0;pass<5;pass++){
    const sites=Array.from({length:24},(_,i)=>rectangle(String(i),random()*800-400,random()*800-400,10+random()*30,10+random()*30,i%2?'embassy':'police'));
    sites[0].name='Kuvendi';sites[1].name='Service office';sites.push({...sites[2],buildingId:'duplicate-name'});
    const roads=Array.from({length:120},()=>({a:[random()*1000-500,random()*1000-500],b:[random()*1000-500,random()*1000-500],w:random()*12+1,walk:random()>.8}));
    const world={roads},env={collide:collideFor(sites)};
    const actual=indexed.createInstitutionGuards(world,env,sites);
    assert.deepEqual(plain(actual),plain(exhaustive.createInstitutionGuards(world,env,sites)));
    for(const guard of actual){
      assert.ok(!roads.some(road=>!road.walk&&segmentDistance(guard.x,guard.z,road.a,road.b)<road.w/2+.55));
      assert.ok(!sites.some(site=>containsPoint(guard.x,guard.z,site.footprint)));
    }
  }
});

test('wide roads, long diagonal segments and endpoint margins across cells retain exact exclusions',()=>{
  const sites=[rectangle('positive',80,80),rectangle('negative',-98,-98),rectangle('wide',240,80)];
  const world={roads:[
    {a:[79.9,60],b:[79.9,100],w:1},
    {a:[-240,-240],b:[160,160],w:2},
    {a:[-79.9,-100],b:[-79.9,-98],w:2},
    {a:[380,50],b:[380,120],w:270},
    {a:[70,70],b:[110,110],w:200,walk:true}
  ]};
  const env={collide:collideFor(sites)};
  assert.deepEqual(plain(indexed.createInstitutionGuards(world,env,sites)),plain(exhaustive.createInstitutionGuards(world,env,sites)));
});

test('reused road index avoids distant segment scans when the collision environment changes',()=>{
  const sites=[rectangle('local',0,0)];
  let reads=0;
  const remote={b:[750,750],w:6,get a(){reads++;return [700,700];}};
  const world={roads:[remote]};
  const first=indexed.createInstitutionGuards(world,{collide:collideFor(sites)},sites);
  assert.equal(first.length,2);
  reads=0;
  const second=indexed.createInstitutionGuards(world,{collide:collideFor(sites)},sites);
  assert.deepEqual(plain(second),plain(first));
  assert.equal(reads,0,'cached road broad phase must not rescan unrelated segments');
});
