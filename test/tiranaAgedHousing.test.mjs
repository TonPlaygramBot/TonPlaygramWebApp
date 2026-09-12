import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {housingEra,rooftopTanks,roofClearance} from '../webapp/src/games/tirana-city-source/housingCore.mjs';
import {AGED_HOUSING} from '../webapp/src/games/tirana-city-source/housingRegistry.mjs';
import {exteriorFrontage} from '../webapp/src/games/tirana-city-source/entranceCore.mjs';
import {facadeEdges} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import {landmarkBuildings} from '../webapp/src/games/tirana-city-source/landmarkCatalog.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';

const fixture={id:'roof',h:16,p:[[0,0],[30,0],[30,20],[0,20]],holes:[[[10,5],[20,5],[20,15],[10,15]]],tags:{building:'apartments','building:levels':'5'}};
test('classification keeps construction evidence separate from morphology',()=>{
  assert.equal(housingEra(fixture).confidence,'typology-estimate');
  assert.equal(housingEra(fixture,{...fixture.tags,start_date:'1970'}).confidence,'source-date');
  for(const tags of [{start_date:'2015'},{start_date:'1930'},{amenity:'school'},{tourism:'hotel'},{'roof:shape':'gabled'},{building:'commercial'},{'building:part':'yes'}])assert.equal(housingEra(fixture,{...fixture.tags,...tags}),null);
});
test('all classified mapped roofs receive 5–7 deterministic, non-overlapping tanks',()=>{
  assert.ok(AGED_HOUSING.length>0);
  for(const b of [...AGED_HOUSING,fixture]){
    const tanks=rooftopTanks(b);assert.ok(tanks.length>=5&&tanks.length<=7,b.id);
    assert.deepEqual(tanks,rooftopTanks(b));
    for(const [i,t] of tanks.entries()){
      assert.ok(roofClearance(t.x,t.z,b.p,b.holes)>=t.radius+.3,b.id);
      for(const other of tanks.slice(i+1))assert.ok(Math.hypot(t.x-other.x,t.z-other.z)>t.radius+other.radius+.2);
    }
  }
});
test('Kryeministria frontage remains on boulevard, spanning its split source segments',()=>{
  const b=landmarkBuildings(WORLD).find(b=>b.id==='384505310');
  const front=exteriorFrontage(facadeEdges(b.p),[-1,0]);
  assert.ok(front.nx<-.97);assert.ok(front.x<160);assert.ok(front.length>50);
  assert.deepEqual(front.a,[147.872,609.922]);
});

const temporary=await mkdtemp(join(tmpdir(),'tirana-aged-runtime-'));let api;
try{
 const file=join(temporary,'runtime.mjs');
 await build({stdin:{contents:"export * as T from 'three';export {AgedHousingLayer} from './src/games/tirana-city-source/AgedHousingLayer';export {ReferenceFacades} from './src/games/tirana-city-source/ReferenceFacades';",resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},outfile:file,bundle:true,platform:'node',format:'esm'});
 api=await import(pathToFileURL(file).href);
}finally{await rm(temporary,{recursive:true,force:true});}
test('actual Three geometry obeys proximity budgets, AC coverage and disposal',()=>{
  const layer=new api.AgedHousingLayer(undefined,false);
  for(const [i,b] of AGED_HOUSING.entries()){
    layer.update(i+1,{x:b.x,z:b.z});
    assert.ok(layer.group.children.length<=36);
    const visible=layer.group.children.filter(g=>g.visible);assert.ok(visible.length<=24);
    for(const g of visible){assert.ok(g.userData.tanks>=5&&g.userData.tanks<=7);if(g.userData.windows>20)assert.ok(g.userData.airConditioners/g.userData.windows>.85);}
    if(i>=35)break;
  }
  const b=AGED_HOUSING[0];layer.update(100,{x:b.x,z:b.z},true);assert.ok(layer.group.children.filter(g=>g.visible).length<=12);
  const geometries=new Set();layer.group.traverse(o=>{if(o instanceof api.T.Mesh){geometries.add(o.geometry);const p=o.geometry.attributes.position;for(const n of p.array)assert.ok(Number.isFinite(n));}});
  let released=0;geometries.forEach(g=>g.addEventListener('dispose',()=>released++));
  layer.dispose();layer.dispose();assert.equal(released,geometries.size);assert.equal(layer.group.children.length,0);
});
test('all three corrected civic/hotel models construct finite merged geometry',()=>{
  const layer=new api.ReferenceFacades(WORLD,new Set(['175108137','249185545','384505310']));
  assert.equal(layer.group.children.length,3);
  layer.group.traverse(o=>{if(o instanceof api.T.Mesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});
  layer.dispose();
});
