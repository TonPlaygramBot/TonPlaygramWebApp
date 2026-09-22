import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createState,stepState,SPAWN} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {shopLayout} from '../webapp/src/games/tiranastreets/shared/shopLayout.mjs';
import {shopObstacles} from '../webapp/src/games/tiranastreets/shared/cityPopulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import {WEAPON_STORE_CATALOG} from '../webapp/src/games/tiranastreets/weaponStoreCatalog.mjs';
import {UPLOADED_WEAPONS} from '../webapp/src/games/tiranastreets/shared/uploadedWeapons.mjs';
const state=createState([{id:'local',name:'Shop test'}],'free-roam','solo');
const root=fileURLToPath(new URL('../',import.meta.url));
const web=createRequire(path.join(root,'webapp/package.json')),ts=web('typescript'),T=web('three');
const load=(file,deps,globals={})=>{
  const module={exports:{}},code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:key=>{assert.ok(key in deps,`Unexpected import ${key}`);return deps[key];},console,...globals});
  return module.exports;
};

test('all original shop locations use one terrain datum and bounded access within the existing footprint',()=>{
  const elevated=state.shops.filter(s=>shopLayout(s).stairCount);
  assert.deepEqual(elevated.map(s=>s.id),['arsenal-3','arsenal-4','arsenal-7','arsenal-8','arsenal-15']);
  for(const shop of state.shops){
    const layout=shopLayout(shop),solids=shopObstacles().filter(b=>b.id.startsWith(`${shop.id}-solid-`));
    assert.equal(solids.length,layout.solids.length);assert.ok(layout.stairCount<=32);
    for(const b of solids){assert.equal(b.baseY,layout.baseY);assert.ok(b.minX>=shop.x-6.511&&b.maxX<=shop.x+6.511&&b.minZ>=shop.z-10.511&&b.maxZ<=shop.z+2.501);}
    if(!layout.stairCount){assert.equal(layout.baseY,0);assert.equal(solids.length,5,'central shops retain the original five collision pieces');}
  }
});

test('the capsule walks from terrain through every entrance to the counter without teleporting or changing movement limits',()=>{
  let largestRise=0;
  for(const shop of state.shops){
    const layout=shopLayout(shop),world=new StreetWorld(layout.solids,false);
    const p={x:shop.x,z:shop.z+3.5,y:groundHeight(shop.x,shop.z+3.5)+.08};
    largestRise=Math.max(largestRise,layout.baseY+.18-p.y);
    for(let i=0;i<220&&p.z>shop.z-6.3;i++){
      const previous={...p};world.move(p,0,-.06,1.78);
      assert.ok(p.y-previous.y<=.280001,`${shop.id}: step limit`);
      assert.ok(Math.abs(p.z-previous.z)<=.060001,`${shop.id}: continuous movement`);
      assert.ok(world.clearance(p,1.78),`${shop.id}: valid standing capsule`);
    }
    assert.ok(p.z<shop.z-6.3,`${shop.id}: counter reached, stopped at ${p.z-shop.z}`);
    assert.ok(Math.abs(p.y-layout.baseY-.18)<.001,`${shop.id}: common floor reached`);
    assert.equal(world.clearance({x:shop.x+6.4,y:layout.baseY+.18,z:shop.z-3},1.78),false);
    const hit=world.cast({x:shop.x+8,y:layout.baseY+1.7,z:shop.z-3},{x:-1,y:0,z:0},8);
    assert.equal(hit.objectId,`${shop.id}-solid-2`,'sight hits the original side wall');
  }
  assert.ok(largestRise>6,'covers the highest mountain entrance');
});

test('continuing on a low platform works while excessive steps and low ceilings stay blocked',()=>{
  const box=(id,minY,h,z0,z1)=>({id,baseY:0,minY,h,p:[[-2,z0],[2,z0],[2,z1],[-2,z1]]});
  const floor=box('floor',0,.18,0,4),world=new StreetWorld([floor],false),p={x:0,y:.08,z:-1};
  for(let i=0;i<60;i++)world.move(p,0,.05,1.78);
  assert.ok(p.z>1.9);assert.equal(p.y,.18);
  for(const solids of [[box('too-high',0,.7,0,4)],[floor,box('ceiling',1.6,2.4,0,4)]]){
    const blocked=new StreetWorld(solids,false),q={x:0,y:.08,z:-1};
    for(let i=0;i<60;i++)blocked.move(q,0,.05,1.78);
    assert.ok(q.z<0);assert.equal(q.y,.08);
  }
});

test('dealer standing height survives shared and local simulation, including an older save without height',()=>{
  const saved=structuredClone(state),shops=new Map(saved.shops.map(s=>[s.id,s]));
  for(const n of saved.npcs)if(n.kind==='dealer')delete n.y;
  const verify=()=>{
    for(const n of saved.npcs)if(n.kind==='dealer'){
      const shop=n.id==='dealer'?saved.shop:shops.get(n.id.slice('dealer-'.length));
      assert.equal(n.y,shopLayout(shop).standingY);
      assert.equal(n.x,shop.x);assert.equal(n.z,shop.z);
    }
  };
  stepState(saved,1/60);verify();
  const simulation=new StreetSimulation(saved,new StreetWorld(shopObstacles(),false));
  simulation.step(1/60);verify();
});

test('actual CityStores roots and instanced access match the same collision layout',()=>{
  const {WeaponStoreInterior}=load('webapp/src/games/tiranastreets/WeaponStoreInterior.ts',{
    three:T,'./shared/engine.mjs':{SPAWN},'./weaponStoreCatalog.mjs':{WEAPON_STORE_CATALOG},'./shared/uploadedWeapons.mjs':{UPLOADED_WEAPONS},
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:class{}},'./weaponModelResources':{prepareWeaponScene(){},releaseBatchedSourceGeometry(){},disposeWeaponResources(){}}
  });
  const context={fillRect(){},fillText(){}},document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  const {CityStores}=load('webapp/src/games/tiranastreets/population/CityStores.ts',{three:T,'../WeaponStoreInterior':{WeaponStoreInterior},'../shared/shopLayout.mjs':{shopLayout}},{document});
  const stores=new CityStores();stores.template.updateDisplays=()=>{};
  stores.update(state,state.shops[0]);
  for(const shop of state.shops){
    const layout=shopLayout(shop),room=stores.group.children.find(o=>o.name===shop.name);
    assert.ok(room);assert.equal(room.position.x,shop.x);assert.equal(room.position.z,shop.z);assert.equal(room.position.y,layout.baseY);
    const originalFloor=room.children.find(o=>o instanceof T.Mesh&&o.geometry===stores.floor.geometry);
    assert.equal(originalFloor.visible,!layout.stairCount);
    const access=room.getObjectByName('Terrain-aligned shop access');
    if(layout.extras.length){
      assert.ok(access instanceof T.InstancedMesh);assert.equal(access.count,layout.extras.length);
      const matrix=new T.Matrix4(),point=new T.Vector3();
      layout.extras.forEach((b,i)=>{access.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert.ok(Math.abs(point.y-(b.h+b.minY)/2)<1e-5);});
    }else assert.equal(access,undefined);
  }
  stores.dispose();assert.equal(stores.group.children.length,0);
});
