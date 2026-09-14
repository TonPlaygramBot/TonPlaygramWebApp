const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const web = createRequire(path.resolve(__dirname, '../webapp/package.json'));
const ts = web('typescript'), T = web('three');
function load(file, deps, globals = {}) {
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
  }).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:k=>deps[k]||{},
    console,Map,Set,AbortController,setTimeout,clearTimeout,...globals});
  return module.exports;
}
async function fleetFixture() {
  const catalog = await import('../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs');
  class Draco {setDecoderPath(){return this;}setWorkerLimit(){return this;}dispose(){}}
  class Loader {setDRACOLoader(){return this;}}
  const wheels = load('webapp/src/games/tiranastreets/rollingWheels.ts',{three:T,'./shared/rollingWheelRigs.mjs':await import('../webapp/src/games/tiranastreets/shared/rollingWheelRigs.mjs')});
  const {CollectionVehicleVisuals} = load('webapp/src/games/tiranastreets/CollectionVehicleVisuals.ts',{
    three:T,
    './rollingWheels':wheels,
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:Loader},
    'three/examples/jsm/loaders/DRACOLoader.js':{DRACOLoader:Draco},
    'three/examples/jsm/utils/SkeletonUtils.js':{clone:o=>o.clone(true)},
    './shared/vehicleCollection.mjs':catalog,
    '../tirana-east/terrainTransforms':{alignVehicle(){}},
    '../tirana-east/terrainCore.mjs':{groundHeight:()=>0},
    './NpcVehicleDriver':{createNpcVehicleDriver:()=>{const g=new T.Group();g.userData.role='npc-driver';return g;}},
    './weaponModelResources':{clearWeaponInstance(){},disposeWeaponResources(){}}
  });
  const fleet=new CollectionVehicleVisuals();
  fleet.sources.set('benz',{root:new T.Group(),used:0});
  fleet.pump=()=>{}; // All network states are supplied explicitly below.
  return {fleet,car:{id:'test-car',collectionVehicle:'benz',x:0,z:0,heading:0,npcDriver:true}};
}
test('a missing driver download cannot hide a successfully loaded car',async()=>{
  const {fleet,car}=await fleetFixture();fleet.errors.set('driver','HTTP 503');
  fleet.update([car],{x:0,z:0},1/60);
  assert.equal(fleet.owns(car),true);
  assert.equal(fleet.getRoot(car.id).visible,true);
  assert.equal(fleet.getRoot(car.id).children.length,1);
  fleet.dispose();
});
test('a driver arriving after its car is attached once and yields the seat to the player',async()=>{
  const {fleet,car}=await fleetFixture();fleet.update([car],car,1/60);
  fleet.human=new T.Group();fleet.update([car],car,1/60);fleet.update([car],car,1/60);
  const root=fleet.getRoot(car.id);assert.equal(root.children.length,2);
  const driver=root.children.find(c=>c.userData.role==='npc-driver');assert.ok(driver.visible);
  car.driver='local';car.npcDriver=false;fleet.update([car],car,1/60,car.id);assert.equal(driver.visible,false);
  car.driver=null;fleet.update([car],car,1/60);assert.equal(driver.visible,false);
  fleet.dispose();
});
test('civilian models use original asset dimensions and their actual cockpit sockets',async()=>{
  const {CIVILIAN_VEHICLE_MODELS,roadVehicleFor}=await import('../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs');
  const {vehicleSize}=await import('../webapp/src/games/tiranastreets/shared/trafficSimulation.mjs');
  const {driverSocket}=await import('../webapp/src/games/tiranastreets/shared/driverView.mjs');
  assert.equal(new Set(Object.values(CIVILIAN_VEHICLE_MODELS)).size,3);
  for(const model of Object.keys(CIVILIAN_VEHICLE_MODELS)){
    const car={id:model,model},asset=roadVehicleFor(car),seat=driverSocket(car);
    assert.ok(asset.url.includes('/vehicle-collection/'));
    assert.deepEqual(vehicleSize(car),{length:asset.length,width:asset.width});
    assert.equal(seat.x,asset.driverSeat[2]);assert.equal(seat.z,-asset.driverSeat[0]);
    assert.ok(seat.y<asset.height);
  }
  assert.equal(roadVehicleFor({model:'police',forceVehicle:'patrol_sedan'}),undefined);
});
test('Tirana contains no Racing Royal karts or invisible kart collision props',async()=>{
  const {createState,FREE_ROAM}=await import('../webapp/src/games/tiranastreets/shared/engine.mjs');
  const {props,OBSTACLES}=await import('../webapp/src/games/blackwater/shared/layout.mjs');
  const state=createState([{id:'local',name:'You'}],FREE_ROAM.id,'solo');
  assert.ok(state.cars.length>10);
  assert.equal(state.cars.some(c=>c.racingAsset||c.id.startsWith('royal-')),false);
  assert.equal(props.some(c=>c.racingAsset),false);
  assert.equal(OBSTACLES.some(c=>c.racingAsset),false);
  const {VEHICLE_COLLECTION}=await import('../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs');
  const ids=state.cars.filter(c=>c.collectionVehicle).map(c=>c.collectionVehicle);
  assert.deepEqual(new Set(ids),new Set(VEHICLE_COLLECTION.map(c=>c.id)));
  assert.ok(ids.includes('golf-gti'),'the starter GTI remains alongside the parked originals');
});
function runtimeFixture(hidden=false){
  const document={hidden};
  const {StreetCareerRuntime}=load('webapp/src/games/tiranastreets/street-career/StreetCareerRuntime.ts',{
    './campaignCore.mjs':{createCampaign:()=>({})}
  },{document});
  const runtime=Object.create(StreetCareerRuntime.prototype);
  return {StreetCareerRuntime,document,runtime};
}
test('resume cannot restart a hidden tab or an unavailable graphics context',()=>{
  const {runtime,document}=runtimeFixture(true);
  let resumed=0;Object.assign(runtime,{ready:true,disposed:false,paused:true,state:{phase:'active'},
    input:{setEnabled(){resumed++;}},simulation:{resume(){}},audio:{unlock:async()=>{}},emit(){}});
  runtime.resume();assert.equal(resumed,0);assert.equal(runtime.paused,true);
  document.hidden=false;runtime.ready=false;runtime.resume();assert.equal(resumed,0);
  runtime.ready=true;runtime.graphicsError='context lost';runtime.resume();assert.equal(resumed,0);
  runtime.graphicsError='';runtime.resume();assert.equal(resumed,1);assert.equal(runtime.paused,false);
});
