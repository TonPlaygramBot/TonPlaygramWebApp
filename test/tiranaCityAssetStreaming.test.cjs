const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const base=path.resolve(__dirname,'../webapp/src/games/tiranastreets');
function load(file,deps={},globals={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},console,performance,...globals});return module.exports;
}
function codecFixture(){
 const codecs=[];
 class Codec{constructor(){codecs.push(this);}setDecoderPath(path){this.path=path;return this;}setTranscoderPath(path){this.path=path;return this;}setWorkerLimit(limit){this.limit=limit;return this;}detectSupport(renderer){this.renderer=renderer;return this;}dispose(){this.disposed=true;}}
 class Loader{setDRACOLoader(decoder){this.dracoDecoder=decoder;return this;}setKTX2Loader(decoder){this.ktxDecoder=decoder;return this;}setMeshoptDecoder(decoder){this.meshoptDecoder=decoder;return this;}}
 const meshopt={ready:Promise.resolve()};
 const exports=load('CityAssetLoader.ts',{three:T,'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:Loader},'three/examples/jsm/loaders/DRACOLoader.js':{DRACOLoader:Codec},'three/examples/jsm/loaders/KTX2Loader.js':{KTX2Loader:Codec},'three/examples/jsm/libs/meshopt_decoder.module.js':{MeshoptDecoder:meshopt}});
 return {...exports,codecs,meshopt};
}
test('city codec pool configures local Draco, Meshopt and capability-aware KTX2 with one worker each',()=>{
 const {CityAssetLoader,codecs,meshopt}=codecFixture(),loader=new CityAssetLoader(),renderer={};
 loader.configure(renderer);
 assert.equal(loader.meshoptDecoder,meshopt);assert.equal(loader.ktxDecoder.renderer,renderer);
 assert.ok(codecs.every(codec=>codec.limit===1&&codec.path.startsWith('/vendor/three/')));
 loader.dispose();assert.ok(codecs.every(codec=>codec.disposed));
});
test('city texture sampling preserves original maps, UV transforms, alpha and PBR channels',()=>{
 const {prepareCityAssetTextures}=codecFixture(),map=new T.Texture(),normal=new T.Texture(),packed=new T.Texture();
 map.colorSpace=T.SRGBColorSpace;map.repeat.set(3,5);map.offset.set(.2,.4);normal.colorSpace=T.NoColorSpace;
 const material=new T.MeshStandardMaterial({color:0x9a7b56,map,normalMap:normal,roughnessMap:packed,metalnessMap:packed,alphaTest:.43,roughness:.62,metalness:.21});
 const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(),material),new T.Mesh(new T.BoxGeometry(),material));
 const version=packed.version;prepareCityAssetTextures(root,16);
 assert.equal(material.map,map);assert.equal(material.roughnessMap,packed);assert.equal(material.metalnessMap,packed);
 assert.equal(material.color.getHex(),0x9a7b56);assert.equal(material.alphaTest,.43);assert.equal(material.roughness,.62);assert.equal(material.metalness,.21);
 assert.deepEqual(map.repeat.toArray(),[3,5]);assert.deepEqual(map.offset.toArray(),[.2,.4]);assert.equal(normal.colorSpace,T.NoColorSpace);
 assert.equal(map.anisotropy,8);assert.equal(packed.version,version+1,'a shared packed map is prepared only once');
 prepareCityAssetTextures(root,16);assert.equal(packed.version,version+1,'unchanged texture does not request upload again');
 prepareCityAssetTextures(root,2);assert.equal(map.anisotropy,2);
});
function streamFixture(){
 let now=0,calls=0,releases=0,loaderDisposals=0,fail=false,resolve;
 const material=new T.MeshStandardMaterial(),geometry=new T.BoxGeometry(2,2,2),scene=new T.Group();scene.add(new T.Mesh(geometry,material));
 let sourceDisposals=0;material.addEventListener('dispose',()=>sourceDisposals++);
 class Loader{configure(){}dispose(){loaderDisposals++;}loadAsync(){calls++;if(resolve==='pending')return new Promise(r=>{resolve=r;});return fail?Promise.reject(Error('temporary connection failure')):Promise.resolve({scene});}}
 const resources=load('weaponModelResources.ts',{three:T,'three/examples/jsm/utils/BufferGeometryUtils.js':{}});
 const {ImportedAssetVisuals}=load('ImportedAssetVisuals.ts',{three:T,'./CityAssetLoader':{CityAssetLoader:Loader,prepareCityAssetTextures(){}},'three/examples/jsm/utils/SkeletonUtils.js':{clone:source=>source.clone(true)},'../kartroyale/vehicleAssetConfig.mjs':{vehicleAssetUrl:()=>'/racing.glb'},'../kartroyale/vehicleAssetAdapter':{prepareVehicleAsset(){}},'./shared/importedAssets.mjs':{IMPORTED_BY_ID:new Map([['original',{localUrl:'/original.glb',length:4}]])},'../tirana-east/terrainCore.mjs':{groundHeight:()=>0},'../tirana-east/terrainTransforms':{alignVehicle(){}},'./weaponModelResources':{...resources,clearWeaponInstance:root=>{releases++;resources.clearWeaponInstance(root);}}},{performance:{now:()=>now}});
 const layer=new ImportedAssetVisuals(),entries=[{id:'a',assetId:'original',x:0,z:0}],viewer={x:0,z:0};
 return {layer,entries,viewer,scene,calls:()=>calls,releases:()=>releases,sourceDisposals:()=>sourceDisposals,loaderDisposals:()=>loaderDisposals,setFail:value=>fail=value,advance:value=>now=value,update:()=>layer.update(entries,viewer,false,now),pause:()=>resolve='pending',finish:()=>resolve({scene})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('transient asset failures retry with backoff, clear error on recovery, and remain bounded',async()=>{
 const f=streamFixture();f.setFail(true);f.update();await settle();assert.equal(f.calls(),1);assert.equal(f.layer.errors.size,1);
 f.advance(999);f.update();await settle();assert.equal(f.calls(),1);
 f.advance(1000);f.update();await settle();assert.equal(f.calls(),2);
 f.setFail(false);f.advance(4999);f.update();await settle();assert.equal(f.calls(),2);
 f.advance(5000);f.update();await settle();assert.equal(f.calls(),3);assert.equal(f.layer.errors.size,0);
 f.update();assert.ok(f.layer.has('a'));f.layer.dispose();assert.equal(f.layer.group.children.length,0);assert.equal(f.releases(),1);assert.equal(f.sourceDisposals(),1);
 const failed=streamFixture();failed.setFail(true);
 for(const now of [0,1000,5000,21000,100000]){failed.advance(now);failed.update();await settle();}
 assert.equal(failed.calls(),3,'permanent missing assets cannot retry every frame');failed.layer.dispose();
});
test('selected source models are retained while the per-frame clone budget fills all placements',()=>{
 const f=streamFixture(),rows=Array.from({length:14},(_,i)=>({id:String(i),assetId:'asset-'+i,x:i,z:0}));
 for(const row of rows)f.layer.sources.set(row.assetId,new T.Group());
 f.layer.update(rows,f.viewer,false,0);assert.equal(f.layer.instances.size,2);assert.equal(f.layer.sources.size,14,'pending placements must not evict each other');
 for(let i=1;i<7;i++)f.layer.update(rows,f.viewer,false,i*16);
 assert.equal(f.layer.instances.size,14);f.layer.dispose();assert.equal(f.releases(),14);assert.equal(f.layer.group.children.length,0);
});
test('late asset completion after leaving the game releases resources without resurrecting the scene',async()=>{
 const f=streamFixture();f.pause();f.update();f.layer.dispose();assert.equal(f.loaderDisposals(),0,'keep codec workers alive until in-flight decode settles');f.finish();await settle();
 assert.equal(f.loaderDisposals(),1);f.layer.dispose();assert.equal(f.loaderDisposals(),1);
 assert.equal(f.layer.sources.size,0);assert.equal(f.layer.instances.size,0);assert.equal(f.layer.group.children.length,0);assert.equal(f.sourceDisposals(),1);
});
test('failed player loading waits for concurrent city decoding and releases the unattached original',async()=>{
 let finishCity,codecDisposals=0,cityDisposals=0;
 const pendingCity=new Promise(resolve=>{finishCity=resolve;});
 class Loader{configure(){}loadAsync(){return pendingCity;}dispose(){codecDisposals++;}}
 const deps=new Proxy({three:T,'./CityAssetLoader':{CityAssetLoader:Loader},'./HumanModelLoader':{HumanModelLoader:class{configure(){}dispose(){}}},'./playerCatalog.mjs':{selectedPlayerUrl:()=>'/player.glb'},'./playerModelBytes.mjs':{loadPlayerModelBytes:()=>Promise.reject(Error('player unavailable'))},'./shared/vehicleCollection.mjs':{CIVILIAN_VEHICLE_MODELS:{}}},{has:()=>true,get:(target,key)=>target[key]??{}});
 const {CityRenderer}=load('cityBaseRenderer.ts',deps,{AbortController});
 const renderer=Object.assign(Object.create(CityRenderer.prototype),{renderer:{},disposed:false,disposeObject(){cityDisposals++;}});
 await assert.rejects(renderer.load(),/player unavailable/);await settle();
 assert.equal(codecDisposals,0,'a sibling load failure must not terminate active codec workers');
 finishCity({scene:new T.Group()});await settle();
 assert.equal(codecDisposals,1);assert.equal(cityDisposals,1,'the late city is not attached or leaked');
});
test('battlefield keeps imported prop collision and reports load failures without visible substitute blocks',()=>{
 let configured;
 class GroupLayer{group=new T.Group();configure(renderer){configured=renderer;}update(){}dispose(){}}
 class Imported extends GroupLayer{errors=new Map([['original','unavailable']]);}
 class City extends GroupLayer{city={group:new T.Group()};}
 const obstacle={x:5,z:5,w:4,h:2,d:2},scene=new T.Scene(),camera=new T.PerspectiveCamera();
 scene.add(new T.DirectionalLight());
 const renderer=Object.assign(Object.create(T.WebGLRenderer.prototype),{shadowMap:{enabled:true}});
 const {makeCityWorld}=load('../blackwater/cityWorld.ts',{
  three:T,'../tirana-environment/CinematicAtmosphere':{CinematicAtmosphere:GroupLayer},
  '../tiranastreets/CollectionVehicleVisuals':{CollectionVehicleVisuals:class extends GroupLayer{errors=new Map();}},
  '../tiranastreets/ImportedAssetVisuals':{ImportedAssetVisuals:Imported},
  '../tiranastreets/AlbanianForcesVisuals':{AlbanianForcesVisuals:GroupLayer},
  '../tiranastreets/TiranaCityScene':{TiranaCityScene:City},
  'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:class{}},
  './world':{makeWorld:()=>({extraction:new T.Object3D(),sky:Object.assign(new T.Object3D(),{material:{uniforms:{top:{value:new T.Color()},bottom:{value:new T.Color()}}}}),rain:new T.Object3D(),dispose(){}})},
  '../tiranastreets/FpsCity':{disposeObject(){}},
  './shared/layout.mjs':{ORIGIN:{x:0,z:0},OBSTACLES:[obstacle],START:{x:0,z:0},EXTRACTION:{x:10,z:10},props:[{...obstacle,rot:0,assetId:'original'}]}
 });
 const world=makeCityWorld(scene,camera,renderer);
 assert.equal(configured,renderer);
 assert.equal(world.obstacles[0],obstacle,'render policy does not remove simulation collision');
 assert.equal(scene.getObjectByName('FPS cover and Tirana parked cars').children.length,0);
 assert.equal(scene.userData.tiranaCity.importedErrors.original,'unavailable');
 world.update(new T.Vector3(0,1.7,0));
 assert.equal(scene.getObjectByName('FPS cover and Tirana parked cars').children.length,0);
 world.dispose();
});
test('portrait canopy spends original glTF slots on visible trees and refreshes when turning in place',()=>{
 const {MatureTreeLayer}=load('../tirana-street-life/MatureTreeLayer.ts',{
  three:T,'./ImportedTreeLayer':{},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{},'./canopyRegistry.mjs':{},'./streetModels.mjs':{},'../tirana-street-detail/roadDetailCore.mjs':{}
 });
 const tree=(id,z,shape='garden')=>({id,x:0,y:.12,z,shape,height:10,crown:8,seed:1,zone:'test'});
 const trees=[...Array.from({length:8},(_,i)=>tree('behind-'+i,20+i*3)),tree('front',-90),tree('far',-180),tree('cypress',-40,'column')];
 const group=new T.Group();group.position.set(-800,0,-400);
 const imported={ready:true,group:new T.Group(),accepted:[],request(){},begin(){this.accepted=[];},add(t,battery){if(this.accepted.length>=(battery?3:8))return false;this.accepted.push(t.id);return true;},end(){this.group.userData.visibleTrees=this.accepted.length;}};
 const batches=[];
 for(const shape of ['garden','column'])for(const lod of [0,1,2])batches.push({shape,lod,wood:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),20),leaves:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),20)});
 const layer=Object.assign(Object.create(MatureTreeLayer.prototype),{group,dead:false,last:-Infinity,imported,importedReady:true,near:()=>trees,batches,dummy:new T.Object3D(),color:new T.Color(),viewer:{x:Infinity,z:Infinity},cameraMatrix:new T.Matrix4(),cameraProjection:new T.Matrix4(),frustum:new T.Frustum(),projection:new T.Matrix4(),treeBounds:new T.Sphere()});
 const camera=new T.PerspectiveCamera(55,9/16,.1,2000);camera.position.set(-800,5,-400);camera.lookAt(-800,5,-500);
 layer.update(0,{x:0,z:0},false,false,camera);
 assert.deepEqual(imported.accepted,['front'],'behind-camera trees cannot consume the original-model budget');
 assert.equal(layer.group.userData.importedRadius,125);assert.equal(layer.group.userData.visibleTrunks,11);
 camera.lookAt(-800,5,-300);layer.update(.3,{x:0,z:0},false,false,camera);
 assert.equal(imported.accepted.length,8);assert.ok(imported.accepted.every(id=>id.startsWith('behind-')),'turning at the same position refreshes visibility');
 layer.update(.31,{x:0,z:0},true,false,camera);assert.equal(imported.accepted.length,3);assert.equal(layer.group.userData.importedRadius,75);
 for(const b of batches){b.wood.dispose();b.leaves.dispose();b.wood.geometry.dispose();b.leaves.geometry.dispose();b.wood.material.dispose();b.leaves.material.dispose();}
});
