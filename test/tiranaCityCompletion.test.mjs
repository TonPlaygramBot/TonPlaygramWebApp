import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {MAPPED_TREES} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {STREET_LIFE} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {CITY_COMPLETION as C} from '../webapp/src/games/tirana-city-completion/data.mjs';
import {COMPLETED_BUILDINGS} from '../webapp/src/games/tirana-city-completion/buildingRegistry.mjs';
import {COMPLETION_MESHES} from '../webapp/src/games/tirana-city-completion/meshData.mjs';
import {inside,distance,spatialIndex,bounds,parkingBays} from '../webapp/src/games/tirana-city-completion/placementCore.mjs';
import {facadeModules} from '../webapp/src/games/tirana-city-completion/facadeCore.mjs';
import {collideStreetProps} from '../webapp/src/games/tiranastreets/shared/streetDressing.mjs';

test('new tree ownership is unique and every placement has finite coordinates',()=>{
 const old=new Set([...MAPPED_TREES,...STREET_LIFE.trees].map(t=>t.id));
 assert.ok(C.trees.length>7000);assert.equal(new Set(C.trees.map(t=>t.id)).size,C.trees.length);
 for(const t of C.trees){assert.ok(!old.has(t.id),t.id);assert.ok(t.height>=2&&t.height<=35);}
 for(const list of [C.trees,C.shrubs,C.fixtures,C.arrows])for(const p of list)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z),p.id);
});
test('mapped fixtures and trunks stay clear of the rendered roads and source buildings',()=>{
 const bs=spatialIndex(WORLD.buildings,b=>bounds(b.p));
 const rs=spatialIndex(WORLD.roads.filter(r=>!r.walk&&!r.bridge&&!r.tunnel),r=>{const b=bounds([r.a,r.b]),p=r.w/2+1;return [b[0]-p,b[1]-p,b[2]+p,b[3]+p];});
 for(const p of [...C.trees,...C.fixtures]){
  assert.ok(!bs(p.x,p.z).some(b=>inside(p.x,p.z,b.p,b.holes)),'building overlap: '+p.id);
  assert.ok(!rs(p.x,p.z).some(r=>distance([p.x,p.z],r.a,r.b)<r.w/2+.19),'road overlap: '+p.id);
 }
});
test('parking bays are inside their recorded surfaces; holes and underground parking are respected',()=>{
 for(const p of C.parking){assert.ok(['surface','lane','street_side'].includes(p.tags.parking));for(const b of p.bays){
  const c=Math.cos(b.yaw),s=Math.sin(b.yaw);for(const [x,z] of [[-b.w/2,-b.d/2],[b.w/2,-b.d/2],[b.w/2,b.d/2],[-b.w/2,b.d/2]])assert.ok(inside(b.x+c*x+s*z,b.z-s*x+c*z,p.p,p.holes),p.id);
 }}
 const base={p:[[0,0],[20,0],[20,30],[0,30]],tags:{parking:'surface'},holes:[[[0,10],[8,10],[8,18],[0,18]]]};
 assert.ok(parkingBays(base).length>0);assert.equal(parkingBays({...base,tags:{parking:'underground'}}).length,0);
 for(const b of parkingBays(base))assert.ok(inside(b.x,b.z,base.p,base.holes));
});
test('Blender assets and registered full buildings preserve source footprints and known height',()=>{
 assert.equal(COMPLETED_BUILDINGS.length,8);
 const metrics=JSON.parse(fs.readFileSync(new URL('../assets-source/tirana-city-completion/building-metrics.json',import.meta.url)));
 for(const b of COMPLETED_BUILDINGS){const source=WORLD.buildings.find(s=>s.id===b.id);assert.ok(source);assert.deepEqual(b.p,source.p);assert.equal(b.h,source.h);
  const metric=metrics.find(m=>m.id===b.id),buffer=fs.readFileSync(new URL('../webapp/public/assets/tirana-streets/neighbourhood/'+metric.file,import.meta.url));
  assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),metric.sha256);
  const doc=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)));assert.ok(!doc.extensionsRequired?.includes('KHR_draco_mesh_compression'));assert.ok(!doc.images?.length);
 }
 for(const parts of Object.values(COMPLETION_MESHES.models))for(const p of parts){assert.equal(p.position.length,p.normal.length);assert.ok(p.position.every(Number.isFinite));assert.equal(p.position.length%9,0);}
});
test('facade completion does not invent floors for unknown or construction buildings',()=>{
 const b={id:'test',p:[[0,0],[20,0],[20,10],[0,10]],h:16,levels:5,tags:{building:'apartments'}};
 assert.ok(facadeModules(b).some(p=>p.model==='window_bay'));
 assert.equal(facadeModules({...b,levels:null,heightSource:'unknown'}).length,0);
 assert.equal(facadeModules({...b,tags:{building:'construction'}}).length,0);
 assert.ok(facadeModules(b).every(p=>p.y<b.h&&p.y>1));
 assert.equal(facadeModules(b).filter(p=>p.model==='entrance_bay').length,1);
});
test('mapped bins and new tree trunks have physical collision',()=>{
 for(const fixture of [C.fixtures.find(f=>f.kind==='waste_container'),C.trees[0]]){
  const p={x:fixture.x,z:fixture.z};assert.ok(collideStreetProps(p,.3));assert.ok(Math.hypot(p.x-fixture.x,p.z-fixture.z)>.1);
 }
});
