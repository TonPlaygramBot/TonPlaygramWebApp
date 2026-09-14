const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
function load(file,deps={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../webapp/src/games/',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},console,performance,setTimeout,clearTimeout});return module.exports;
}
const quality=load('tiranastreets/graphicsQuality.ts');
test('device defaults handle low memory, powerful desktops and unknown hardware',()=>{
 assert.equal(quality.devicePreset({cores:12,memory:2}),'battery');
 assert.equal(quality.devicePreset({cores:12,memory:16}),'high');
 assert.equal(quality.devicePreset({}),'balanced');
 assert.equal(quality.devicePreset({cores:8,mobile:true}),'balanced');
 assert.equal(quality.graphicsSetting('low'),'battery');assert.equal(quality.graphicsSetting('invalid'),'auto');
});
test('automatic graphics reacts to sustained load, recovers slowly and respects device ceiling',()=>{
 const q=new quality.AutomaticGraphics('balanced');
 assert.equal(q.sample(20,60),false);assert.equal(q.sample(20,60),true);assert.equal(q.preset,'battery');
 for(let i=0;i<8;i++)assert.equal(q.sample(60,60),false);
 assert.equal(q.sample(60,60),true);assert.equal(q.preset,'balanced');
 for(let i=0;i<20;i++)q.sample(120,120);assert.equal(q.preset,'balanced');
 q.sample(NaN,60);q.sample(0,60);assert.equal(q.preset,'balanced');
});
test('a 120 FPS cap on a healthy 60 Hz display does not downgrade quality',()=>{
 const q=new quality.AutomaticGraphics('high');for(let i=0;i<20;i++)q.sample(60,120);assert.equal(q.preset,'high');
});
const shell=load('tirana-neighbourhood/buildingShell.ts',{three:T,'../tirana-east/terrainCore.mjs':{buildingGround:()=>0},'./buildingAppearance':{sourceBuildingColour:()=>new T.Color(.7,.7,.7)}});
class Finish{create(){return new T.MeshStandardMaterial();}dispose(){}}
const {CellWorkQueue:Queue}=load('tirana-neighbourhood/cellWorkQueue.mjs');
const {MappedBuildingCells}=load('tirana-neighbourhood/MappedBuildingCells.ts',{
 three:T,'../tiranastreets/renderSettings':{CITY_RADIUS:{battery:2200,high:3200},CITY_CACHE:{battery:320,high:700},runCityWork(q){q.run(1000,600);}},
 '../tirana-east/housingCore.mjs':{housingProfile:()=>null},'../tirana-east/terrainCore.mjs':{buildingGround:()=>0},
 './cellWorkQueue.mjs':{CellWorkQueue:Queue},'./buildingShell':shell,'./buildingAppearance':{sourceBuildingColour:()=>new T.Color(),windowRows:()=>[]},
 '../tirana-environment/EnvironmentMaterials':{EnvironmentMaterials:Finish},'../tirana-environment/riverGeometry':{surfaceGeometry(){}},
 'three/examples/jsm/utils/BufferGeometryUtils.js':{},'../tirana-city-source/sourceCore.mjs':{},'../tirana-city-source/housingRegistry.mjs':{AGED_HOUSING_IDS:new Set()}
});
test('queued districts retain the entire block straddling 2 km and rebuild after eviction',()=>{
 const b={id:'boundary',p:[[1990,-15],[2250,-15],[2250,15],[1990,15]],h:12};
 const layer=new MappedBuildingCells([b],new T.MeshStandardMaterial(),new T.MeshStandardMaterial(),false,false);
 assert.equal(layer.group.children.length,0,'city geometry must not be allocated in the constructor');
 const drain=()=>{for(let i=0;i<1000;i++){layer.update({x:0,z:0},true);if(layer.group.userData.ready)return;}assert.fail('District did not become ready');};
 const mesh=()=>{let result;layer.group.traverse(c=>{if(c.isMesh)result=c;});return result;};
 drain();const shellMesh=mesh();assert.ok(shellMesh);assert.ok(shellMesh.geometry.attributes.position.count>=30);
 shellMesh.updateMatrixWorld();const ray=new T.Raycaster(new T.Vector3(1995,30,0),new T.Vector3(0,-1,0));assert.ok(ray.intersectObject(shellMesh).length,'near edge of complete roof exists');
 const farRay=new T.Raycaster(new T.Vector3(2245,30,0),new T.Vector3(0,-1,0));assert.ok(farRay.intersectObject(shellMesh).length,'far edge of same block stays intact');
 layer.update({x:10000,z:0},true);assert.equal(layer.group.userData.cachedDistricts,0);
 drain();assert.ok(mesh());assert.notEqual(mesh(),shellMesh);layer.dispose();
});
test('resident roofs preserve courtyards instead of filling footprint holes',()=>{
 const p=[],c=[];shell.appendBuildingShell({p:[[0,0],[20,0],[20,20],[0,20]],holes:[[[5,5],[15,5],[15,15],[5,15]]],h:10},p,c);
 const m=new T.Mesh(shell.shellGeometry(p,c),new T.MeshBasicMaterial());m.updateMatrixWorld();
 assert.equal(new T.Raycaster(new T.Vector3(10,30,10),new T.Vector3(0,-1,0)).intersectObject(m).length,0);
 assert.ok(new T.Raycaster(new T.Vector3(2,30,2),new T.Vector3(0,-1,0)).intersectObject(m).length);m.geometry.dispose();m.material.dispose();
});
test('startup mosque shell has complete metre-scale masses while ornament is unavailable',async()=>{
 const utils=await import('../webapp/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');
 const {mosqueShell}=load('tirana-city-source/MosqueShell.ts',{three:T,'three/examples/jsm/utils/BufferGeometryUtils.js':utils});
 const group=mosqueShell();group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);
 assert.equal(group.children.length,2,'two material batches');assert.ok(Math.abs(bounds.max.y-50)<.01);
 assert.ok(bounds.max.x-bounds.min.x>=60);assert.ok(bounds.max.z-bounds.min.z>=78);
 const courtyard=new T.Raycaster(new T.Vector3(0,60,-20),new T.Vector3(0,-1,0)).intersectObject(group,true);
 assert.ok(courtyard.length&&courtyard[0].point.y<1,'courtyard remains open to its floor');
 group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
test('all new Blender exports have complete GLB buffers and finite metre bounds',()=>{
 for(const name of ['namazgah-near','namazgah-far','parliament-entry','villa-bay','villa-balcony']){
  const data=fs.readFileSync(path.join(__dirname,`../webapp/public/assets/tirana-streets/landmark-rebuild/${name}.glb`));
  assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(8),data.length);
  const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));assert.ok(json.meshes.length);
  assert.ok(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'));
  for(const a of json.accessors)for(const n of [...(a.min||[]),...(a.max||[])])assert.ok(Number.isFinite(n));
  if(name.startsWith('namazgah'))assert.ok(Math.abs(Math.max(...json.accessors.filter(a=>a.type==='VEC3'&&a.max).map(a=>a.max[1]))-50)<.01);
 }
});
