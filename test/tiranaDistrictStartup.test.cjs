const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const root=path.resolve(__dirname,'../webapp/src/games');
function load(file,deps){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},performance,console});return module.exports;
}
class Finish{create(){return new T.MeshStandardMaterial();}apply(){}dispose(){}}
const terrain={buildingGround:()=>0,groundHeight:()=>0,urbanDistance:()=>0};
const appearance={sourceBuildingColour:()=>new T.Color(.7,.7,.7),windowRows:()=>[]};
const shell=load('tirana-neighbourhood/buildingShell.ts',{three:T,'../tirana-east/terrainCore.mjs':terrain,'./buildingAppearance':appearance});
const drape=load('tirana-east/drapeGeometry.ts',{three:T,'./terrainCore.mjs':terrain});
let CellWorkQueue,roadCore;
test.before(async()=>{
 ({CellWorkQueue}=await import('../webapp/src/games/tirana-neighbourhood/cellWorkQueue.mjs'));
 roadCore=await import('../webapp/src/games/tirana-environment/roadSurfaceCore.mjs');
});
// One actual generator step per frame makes cooperative progress observable.
const settings={CITY_RADIUS:{battery:2200,high:3200},CITY_CACHE:{battery:320,high:700},runCityWork:q=>q.run(1,1,()=>0)};
function buildings(rows){
 const {MappedBuildingCells}=load('tirana-neighbourhood/MappedBuildingCells.ts',{
  three:T,'../tiranastreets/renderSettings':settings,'../tirana-east/housingCore.mjs':{housingProfile:()=>null},
  '../tirana-east/terrainCore.mjs':terrain,'./cellWorkQueue.mjs':{CellWorkQueue},'./buildingShell':shell,'./buildingAppearance':appearance,
  '../tirana-environment/EnvironmentMaterials':{EnvironmentMaterials:Finish},'../tirana-environment/riverGeometry':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{},'../tirana-city-source/sourceCore.mjs':{},'../tirana-city-source/housingRegistry.mjs':{AGED_HOUSING_IDS:new Set()}
 });
 return new MappedBuildingCells(rows,new T.MeshStandardMaterial(),new T.MeshStandardMaterial(),false,false);
}
function roads(rows){
 const {UrbanRoadCells}=load('tirana-neighbourhood/UrbanRoadCells.ts',{
  three:T,'../tiranastreets/renderSettings':settings,'../tirana-east/drapeGeometry':drape,'./cellWorkQueue.mjs':{CellWorkQueue},
  '../tirana-east/terrainCore.mjs':terrain,
  '../tirana-environment/EnvironmentMaterials':{EnvironmentMaterials:Finish},'../tiranastreets/shared/world.mjs':{WORLD:{roads:rows}},
  '../tirana-environment/riverGeometry':{},'../tirana-environment/roadSurfaceCore.mjs':roadCore,
  '../tirana-environment/roadSurfaceRegistry':{prepareRoadSurfaceIndex(){throw Error('Detailed road mask must not block initial coverage');}},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{}
 });
 return new UrbanRoadCells(false);
}
function drain(layer,update){for(let i=0;i<10000;i++){update();if(layer.group.userData.ready)return;}assert.fail('District work did not finish');}
const roofAt=(layer,x,z)=>{layer.group.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(x,30,z),new T.Vector3(0,-1,0)).intersectObject(layer.group,true);};
test('constructor indexes distant buildings without triangulating; queued boundary blocks keep roofs and courtyards',()=>{
 const far={id:'far',p:[[8000,0],[8010,0],[8010,10],[8000,10]],get h(){throw Error('Distant height must not be evaluated');}};
 const near={id:'boundary',p:[[1990,-15],[2450,-15],[2450,15],[1990,15]],holes:[[[2100,-5],[2200,-5],[2200,5],[2100,5]]],h:12};
 const layer=buildings([near,far]);assert.equal(layer.group.children.length,0);assert.equal(layer.group.userData.ready,false);
 layer.update({x:0,z:0},true);assert.equal(layer.group.userData.pendingDistricts,1);assert.equal(layer.group.children.length,0);
 drain(layer,()=>layer.update({x:0,z:0},true));assert.equal(layer.group.userData.loadedDistricts,1);
 assert.ok(roofAt(layer,1995,0).length);assert.ok(roofAt(layer,2445,0).length,'whole block extends beyond 2 km');
 assert.equal(roofAt(layer,2150,0).length,0,'courtyard remains open');
 let disposed=0;layer.group.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));
 layer.update({x:12000,z:0},true);assert.ok(disposed>0);assert.equal(layer.group.userData.cachedDistricts,0);
 drain(layer,()=>layer.update({x:0,z:0},true));assert.ok(roofAt(layer,2445,0).length);layer.dispose();
});
test('roads stream through 2 km with complete boundary surfaces and report progress',()=>{
 const layer=roads([{a:[1990,0],b:[2450,0],w:8},{a:[1990,20],b:[2450,20],w:3,walk:true},{a:[8000,0],b:[8010,0],w:8}]);
 assert.equal(layer.group.children.length,0);assert.equal(layer.group.userData.ready,false);
 layer.update(0,{x:0,z:0},true);assert.equal(layer.group.userData.pendingDistricts,1);assert.equal(layer.group.children.length,0);
 drain(layer,()=>layer.update(0,{x:0,z:0},true));assert.equal(layer.group.userData.loadedDistricts,1);
 assert.ok(roofAt(layer,1995,0).length);assert.ok(roofAt(layer,2445,0).length);assert.ok(roofAt(layer,2445,20).length,'complete walkway too');
 assert.equal(roofAt(layer,8005,0).length,0,'distant geometry was not generated');
 let disposed=0;layer.group.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));
 layer.update(1,{x:12000,z:0},true);assert.ok(disposed>0);assert.equal(layer.group.userData.cachedDistricts,0);layer.dispose();
});
test('teleport cancels staged district geometry and disposes it before publication',()=>{
 const rows=Array.from({length:256},(_,i)=>({id:String(i),p:[[2000,i],[2010,i],[2010,i+.5],[2000,i+.5]],h:10}));
 const layer=buildings(rows),dispose=T.BufferGeometry.prototype.dispose;let released=0;
 T.BufferGeometry.prototype.dispose=function(){released++;return dispose.call(this);};
 try{
  for(let i=0;i<18;i++)layer.update({x:0,z:0},true);
  assert.equal(layer.group.children.length,0,'no incomplete district published');assert.equal(layer.group.userData.ready,false);
  layer.update({x:12000,z:0},true);assert.ok(released>0,'staged mesh released');assert.equal(layer.group.userData.pendingDistricts,0);
  assert.equal(layer.group.children.length,0);layer.dispose();
 }finally{T.BufferGeometry.prototype.dispose=dispose;}
});
