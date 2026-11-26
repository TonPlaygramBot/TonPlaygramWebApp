import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {clearStreetPoint} from '../webapp/src/games/tiranastreets-november/shared/streetSafety.mjs';
import {SIGNALS,segmentDistance} from '../webapp/src/games/tiranastreets-november/shared/streetLayout.mjs';
import {CANOPY_TREES, CANOPY_SOURCE_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {MAPPED_TREES} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {BUS_STOPS} from '../webapp/src/games/tirana-street-life/transitData.mjs';
import {inQuarter,BRIDGE} from '../webapp/src/games/tirana-tabakeve/quarterCore.mjs';
import {HYDROGRAPHY} from '../webapp/src/games/tirana-environment/hydrography.mjs';
import {riverRing} from '../webapp/src/games/tirana-environment/riverShapeCore.mjs';
import {inside} from '../webapp/src/games/tirana-city-completion/placementCore.mjs';
import {pointInUrbanBounds} from '../webapp/src/games/tiranastreets-november/shared/urbanBounds.mjs';
const nearby=([x,z])=> x>=520&&x<=1720&&z>=-175&&z<=645;
const localRoads=WORLD.roads.filter(r=>nearby(r.a)||nearby(r.b));
const footways=localRoads.filter(r=>r.walk||r.cycle);
const river=HYDROGRAPHY.paths.filter(p=>p.lana).map(p=>riverRing(p,6.9));
const occupied=[...CANOPY_TREES,...CANOPY_SOURCE_TREES,...MAPPED_TREES];
export const corridors=Object.freeze({
 'Rruga Petro Nini Luarasi':18,'Rruga Ali Demi':7,'Rruga Mihal Grameno':6,
 'Rruga Bajram Allaraj':5,'Rruga Shyqyri Ishmi':4,'Rruga Dalip Zavalani':4
});
const byDist=(x,z,list)=>Math.min(Infinity,...list.map(p=>Math.hypot(x-p.x,z-p.z)));
export function clearSite(x,z) {
 return inQuarter(x,z)&&pointInUrbanBounds({x,z},4)&&clearStreetPoint({x,z},.85)
  &&!footways.some(r=>segmentDistance(x,z,r.a,r.b)<r.w/2+.95)
  &&!SIGNALS.some(s=>Math.hypot(x-s.x,z-s.z)<s.width/2+7)
  &&byDist(x,z,BUS_STOPS)>=10
  &&byDist(x,z,occupied)>=6.5
  &&Math.hypot(x-BRIDGE.x,z-BRIDGE.z)>=19
  &&!river.some(poly=>inside(x,z,poly));
}
export function generate(){
 const points=[];
 for(const [street,limit] of Object.entries(corridors)){
  const candidates=[];
  for(const r of localRoads){
   if(r.name!==street||r.walk||r.cycle||r.bridge||r.tunnel||r.access==='private'||r.access==='no')continue;
   const dx=r.b[0]-r.a[0],dz=r.b[1]-r.a[1],length=Math.hypot(dx,dz);
   if(length<4)continue;
   const n=Math.max(1,Math.ceil(length/9));
   for(let i=0;i<n;i++)for(const sign of [-1,1]) {
    const t=(i+.5)/n, offset=sign*(r.w/2+1.7);
    const x=+(r.a[0]+dx*t-dz/length*offset).toFixed(2),z=+(r.a[1]+dz*t+dx/length*offset).toFixed(2);
    if(clearSite(x,z))candidates.push({x,z});
   }
  }
  // Fill biggest existing breaks first; do not crowd the established rows.
  for(let i=0;i<limit;i++){
   const scored=candidates.map(p=>({p,d:Math.min(byDist(p.x,p.z,points),byDist(p.x,p.z,occupied))}))
    .filter(({p,d})=>d>=6.5&&byDist(p.x,p.z,points)>=10)
    .sort((a,b)=>b.d-a.d||a.p.x-b.p.x||a.p.z-b.p.z);
   if(!scored.length)break;
   const p=scored[0].p;
   points.push({x:p.x,z:p.z,street});
  }
 }
 return points;
}

import {SOLO_STREET_TREE_INFILL as trees} from '../webapp/src/games/tiranastreets-november/soloStreetTreeInfill.ts';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';

test('solo corridor trees match the bounded, deterministic OSM-aligned gap fill',()=>{
 const planned=generate();
 assert.equal(trees.length,43);
 assert.equal(planned.filter(p=>p.street==='Rruga Petro Nini Luarasi').length,18);
 assert.equal(new Set(planned.map(p=>p.street)).size,6);
 assert.deepEqual(trees.map(({x,z})=>({x,z})),planned.map(({x,z})=>({x,z})));
 assert.equal(new Set(trees.map(t=>t.id)).size,43);
 for (const t of trees) {
  assert.equal(t.zone,'authored-old-street-verge');
  assert.match(t.accuracy,/^Authored visual infill/);
  assert.ok(t.crown<=5.3&&t.height<=11);
 }
});
test('every new tree avoids crossings, shelters, real trunks, houses and the water edge',()=>{
 for(const [i,t] of trees.entries()){
  assert.ok(clearSite(t.x,t.z),t.id);
  assert.ok(byDist(t.x,t.z,trees.slice(0,i))>=10,t.id);
 }
});
test('only the solo renderer opts in, using existing mature tree instancing',()=>{
 const game=new URL('../webapp/src/games/',import.meta.url);
 const solo=readFileSync(new URL('tiranastreets-november/renderer.ts',game),'utf8');
 const racing=readFileSync(new URL('tiranastreets/TiranaCityScene.ts',game),'utf8');
 const shared=readFileSync(new URL('tirana-expansion/WorldEnhancements.ts',game),'utf8');
 assert.match(solo,/supplementalTrees:\s*SOLO_STREET_TREE_INFILL/);
 assert.doesNotMatch(racing,/supplementalTrees|SOLO_STREET_TREE_INFILL/);
 assert.match(shared,/new MatureTreeLayer\([\s\S]{0,150}\? \[\.\.\.CANOPY_TREES, \.\.\.options.supplementalTrees\] : undefined/);
});
