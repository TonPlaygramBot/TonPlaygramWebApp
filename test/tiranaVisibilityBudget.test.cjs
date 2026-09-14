const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const base=path.resolve(__dirname,'../webapp/src/games');
function load(file,deps={},globals={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>deps[id]||{},console,performance,...globals});return module.exports;
}
let visibility;
test.before(async()=>{visibility=await import('../webapp/src/games/tiranastreets/shared/visibilityIndex.mjs');});
test('visibility query visits local indexed cells and retains distant bands within the existing count budget',()=>{
 let reads=0;
 const items=Array.from({length:10000},(_,i)=>({id:i,get x(){reads++;return i*20;},z:0}));
 const index=new visibility.VisibilityIndex(items);reads=0;
 const near=index.query({x:0,z:0},1100);
 assert.ok(reads<100,'query must not revisit every regional placement');
 const selected=visibility.selectVisibilityBands(near,[{radius:180,count:5},{radius:500,count:3},{radius:1100,count:2}]);
 assert.equal(selected.length,10);assert.ok(selected.some(p=>p.distanceSq>500**2));
 assert.equal(index.query({x:NaN,z:0},100).length,0);
});
function facadeFixture(buildings){
 const {CityFacades,FACADE_VISIBILITY}=load('tiranastreets/cityVisuals.ts',{
  three:T,'./shared/visibilityIndex.mjs':visibility,
  './shared/engine.mjs':{WORLD:{buildings},insidePolygon:(x,z,p)=>x>p[0][0]&&x<p[2][0]&&z>p[0][1]&&z<p[2][1]},
  '../tirana-city-source/housingRegistry.mjs':{AGED_HOUSING_IDS:new Set()},
  '../tirana-landmarks/nativeLocations.mjs':{nativeReplacementIds:()=>new Set()},
  '../tirana-landmarks/skanderbegBuilding.mjs':{ROCK_REPLACEMENT_IDS:new Set(['1482874836','1482874842'])},
  '../tirana-city-source/registry.mjs':{INSTITUTION_BUILDING_IDS:new Set()},
  '../tirana-street-life/registry.mjs':{REAL_STOREFRONT_BUILDING_IDS:new Set(),FUEL_CANOPY_IDS:new Set()}
 });
 const source=new T.Group();
 for(const name of ['brick_block','corner_block'])for(const lod of ['', '_lod']){
  const group=new T.Group();group.name=name+lod;group.add(new T.Mesh(new T.BoxGeometry(20,12,20),new T.MeshStandardMaterial()));source.add(group);
 }
 return {layer:new CityFacades(source),profiles:FACADE_VISIBILITY};
}
const building=(id,x,z)=>({id:String(id),p:[[x-10,z-10],[x+10,z-10],[x+10,z+10],[x-10,z+10]],h:12});
test('crowded near facades overflow to LOD instead of disappearing and static views do not upload matrices repeatedly',()=>{
 const {layer}=facadeFixture(Array.from({length:80},(_,i)=>building(i,(i%8)*3-12,Math.floor(i/8)*3-15)));
 layer.update({x:0,z:0},1,false);
 assert.equal(layer.group.userData.visibleBuildings,80);
 assert.equal(layer.batches.reduce((sum,b)=>sum+b.mesh.count,0),80);
 assert.equal(layer.batches.filter(b=>!b.lod).reduce((sum,b)=>sum+b.mesh.count,0),20);
 const versions=layer.batches.map(b=>b.mesh.instanceMatrix.version);
 for(let i=0;i<120;i++)layer.update({x:0,z:0},1/60,false);
 assert.deepEqual(layer.batches.map(b=>b.mesh.instanceMatrix.version),versions);
 for(const {mesh} of layer.batches){assert.ok(mesh.frustumCulled);assert.ok(Number.isFinite(mesh.boundingSphere.radius));}
});
test('generic facade templates never cover the dedicated Skanderbeg podium or face',()=>{
 const {layer}=facadeFixture([building('1482874836',0,0),building('1482874842',20,0)]);
 layer.update({x:0,z:0},1,false);
 assert.equal(layer.group.userData.visibleBuildings,0);
 assert.ok(layer.batches.every(b=>b.mesh.count===0));
});
test('portrait facade selection reaches 1.1 km, respects 100/35 caps, and refreshes when turning or resizing',()=>{
 const rows=Array.from({length:180},(_,i)=>building(i,(i%3-1)*20,-30-i*5));
 rows.push(building('far',0,-1050),building('behind',0,180));
 const {layer}=facadeFixture(rows),camera=new T.PerspectiveCamera(55,.56,.1,3600);
 camera.position.set(0,7,5);camera.lookAt(0,7,-100);
 layer.update({x:0,z:0},1,false,camera);
 assert.ok(layer.group.userData.visibleBuildings<=100);
 const matrix=new T.Matrix4(),positions=()=>layer.batches.flatMap(({mesh})=>Array.from({length:mesh.count},(_,i)=>{mesh.getMatrixAt(i,matrix);return matrix.elements[14];}));
 assert.ok(positions().some(z=>z<-750),'far detail slots survive a dense nearby street');
 assert.ok(positions().every(z=>z<20),'behind-camera details do not consume the budget');
 camera.lookAt(0,7,100);layer.update({x:0,z:0},1,false,camera);
 assert.ok(positions().some(z=>z>100),'rotation refreshes selection without walking');
 camera.lookAt(0,7,-100);layer.update({x:0,z:0},1,true,camera);assert.ok(layer.group.userData.visibleBuildings<=35);
 assert.equal(layer.group.userData.detailRadius,640);
 const version=layer.batches[0].mesh.instanceMatrix.version;
 camera.aspect=1.6;camera.updateProjectionMatrix();layer.update({x:0,z:0},1,true,camera);
 assert.ok(layer.batches[0].mesh.instanceMatrix.version>version,'orientation/aspect updates the frustum');
});
function fpsFixture(){
 const settings=load('tiranastreets/renderSettings.ts');
 const {FpsCity}=load('tiranastreets/FpsCity.ts',{three:T,'./renderSettings':settings,'./shared/visibilityIndex.mjs':visibility});
 const layer=Object.create(FpsCity.prototype),group=new T.Group(),cells=[];
 for(let i=0;i<160;i++){
  const z=-30-i*5,mesh=new T.InstancedMesh(new T.BoxGeometry(3,3,3),new T.MeshBasicMaterial(),1);
  mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(0,10,z));mesh.computeBoundingSphere();group.add(mesh);cells.push({x:0,z,detail:true,object:mesh});
 }
 const shell=new T.Mesh(new T.BoxGeometry(40,80,40),new T.MeshBasicMaterial());shell.position.set(0,40,-2000);group.add(shell);cells.push({x:0,z:-2000,detail:false,object:shell});
 const noop={update(){},setBatteryMode(){}};
 Object.assign(layer,{group,cells,cellViewer:{x:Infinity,z:Infinity},detailIndex:new visibility.VisibilityIndex(cells.filter(c=>c.detail)),cellDirection:new T.Vector3(),lastCellDirection:new T.Vector3(),cellCameraPosition:new T.Vector3(Infinity,Infinity,Infinity),cellProjectionWidth:0,cellProjectionHeight:0,cellFrustum:new T.Frustum(),cellProjection:new T.Matrix4(),cellBounds:new T.Sphere(),landmarks:noop,skanderbegBuilding:noop,referenceFacades:noop,agedHousing:noop,urbanRoads:noop});
 return {layer,shell,cells};
}
test('shared FPS city keeps a 2 km skyline with bounded distant detail and correct translated-origin frustum',()=>{
 const {layer,shell,cells}=fpsFixture(),camera=new T.PerspectiveCamera(60,.56,.1,3600);
 layer.group.position.set(-800,0,-400);camera.position.set(-800,10,-400);camera.lookAt(-800,10,-1000);
 layer.update(new T.Vector3(0,10,0),1,false,camera);
 assert.ok(shell.visible);assert.ok(layer.group.userData.visibleDetailCells<=72);
 assert.ok(cells.some(c=>c.detail&&c.object.visible&&c.z<-600));
 layer.update(new T.Vector3(0,10,0),2,true,camera);
 assert.ok(shell.visible,'battery mode preserves the distant skyline');assert.equal(shell.castShadow,false);
 assert.ok(layer.group.userData.visibleDetailCells<=24);assert.equal(layer.group.userData.detailRadius,480);
 camera.lookAt(-800,10,100);layer.update(new T.Vector3(0,10,0),3,true,camera);
 assert.equal(layer.group.userData.visibleDetailCells,0);
});
function importedFixture(){
 let clones=0,workerLimit;
 class Draco{setDecoderPath(){return this;}setWorkerLimit(value){workerLimit=value;return this;}dispose(){}}
 class Loader{setDRACOLoader(){return this;}}
 const {ImportedAssetVisuals}=load('tiranastreets/ImportedAssetVisuals.ts',{
  three:T,'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:Loader},'three/examples/jsm/loaders/DRACOLoader.js':{DRACOLoader:Draco},
  'three/examples/jsm/utils/SkeletonUtils.js':{clone:source=>{clones++;return source.clone(true);}},
  './shared/importedAssets.mjs':{IMPORTED_BY_ID:new Map()},'../tirana-east/terrainCore.mjs':{groundHeight:()=>0},
  '../tirana-east/terrainTransforms':{alignVehicle(){}},'./weaponModelResources':{disposeWeaponResources(){}}
 });
 const layer=new ImportedAssetVisuals();layer.sources.set('original',new T.Group());layer.load=()=>{};
 return {layer,clones:()=>clones,workerLimit};
}
test('imported originals cap clone bursts, retain per-frame movement, replace asset identity, and evict disappeared entries',()=>{
 const {layer,clones,workerLimit}=importedFixture(),viewer={x:0,z:0};assert.equal(workerLimit,1);
 let rows=Array.from({length:14},(_,i)=>({id:String(i),assetId:'original',x:i,z:0})).reverse();
 layer.update(rows,viewer,false,0);assert.equal(clones(),2);assert.ok(layer.getRoot('0'));assert.ok(layer.getRoot('1'));
 for(let i=1;i<7;i++)layer.update(rows,viewer,false,i*16);
 assert.equal(clones(),14);
 rows=rows.map(e=>e.id==='0'?{...e,x:2}:e);layer.update(rows,viewer,false,112);assert.equal(layer.getRoot('0').position.x,2);
 const selected=layer.selected;layer.update(rows,viewer,false,128);assert.equal(layer.selected,selected,'no resort before selection deadline');
 rows=rows.map(e=>e.id==='0'?{...e,assetId:'replacement'}:e);layer.update(rows,viewer,false,144);assert.equal(layer.has('0'),false,'stale source is not reused under the same entity ID');
 layer.update(rows.filter(e=>e.id!=='1'),viewer,false,160);assert.equal(layer.has('1'),false);
 layer.update(rows,{x:1000,z:0},false,176);assert.equal(layer.group.children.length,0,'teleport refresh is immediate');
 layer.dispose();
});
test('city generation still shares a target-frame CPU allowance across both streams',()=>{
 let clock=0;const settings=load('tiranastreets/renderSettings.ts',{}, {performance:{now:()=>clock}});
 for(const fps of [50,60,90,120]){
  clock=0;const budgets=[];settings.beginCityFrame(fps);
  const queue=()=>({run(budget){budgets.push(budget);clock+=budget;}});
  settings.runCityWork(queue(),false);settings.runCityWork(queue(),false);settings.runCityWork(queue(),false);
  assert.ok(budgets.reduce((a,b)=>a+b,0)<=Math.min(4,1000/fps*.24)+1e-9);
  assert.ok(budgets.every(b=>b<=2));
 }
});
