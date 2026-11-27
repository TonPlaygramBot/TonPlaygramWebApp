const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const base=path.resolve(__dirname,'../webapp/src/games/tiranastreets');
function load(file,deps={},globals={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},console,performance,...globals});return module.exports;
}

const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('portrait canopy spends original glTF slots on visible trees and refreshes when turning in place',async()=>{
 const policy=await import('../webapp/src/games/tirana-street-life/treeLodPolicy.mjs');
 const {MatureTreeLayer}=load('../tirana-street-life/MatureTreeLayer.ts',{
  three:T,'./treeLodPolicy.mjs':policy,'./ImportedTreeLayer':{},'./DistantBroadleafLayer':{},'./loadCompactTree':{},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{},'./canopyRegistry.mjs':{},'./streetModels.mjs':{},'../tirana-street-detail/roadDetailCore.mjs':{}
 });
 const tree=(id,z,shape='garden')=>({id,x:0,y:.12,z,shape,height:10,crown:8,seed:1,zone:'test'});
 const trees=[...Array.from({length:8},(_,i)=>tree('behind-'+i,20+i*3)),tree('front',-90),tree('far',-180),tree('cypress',-40,'column')];
 const group=new T.Group();group.position.set(-800,0,-400);
 const imported={ready:true,group:new T.Group(),accepted:[],request(){},begin(){this.accepted=[];},add(t,battery){if(this.accepted.length>=(battery?3:8))return false;this.accepted.push(t.id);return true;},end(){this.group.userData.visibleTrees=this.accepted.length;}};
 const batches=[];
 for(const shape of ['garden','column'])for(const lod of [0,1,2])batches.push({shape,lod,wood:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),20),leaves:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),20)});
 const layer=Object.assign(Object.create(MatureTreeLayer.prototype),{group,dead:false,last:-Infinity,imported,importedReady:true,mediumReady:false,mediumIds:new Set(),mediumImported:{ready:false,request(){},begin(){},add(){return false},end(){}},near:()=>trees,batches,dummy:new T.Object3D(),color:new T.Color(),viewer:{x:Infinity,z:Infinity},cameraMatrix:new T.Matrix4(),cameraProjection:new T.Matrix4(),frustum:new T.Frustum(),projection:new T.Matrix4(),treeBounds:new T.Sphere()});
 const camera=new T.PerspectiveCamera(55,9/16,.1,2000);camera.position.set(-800,5,-400);camera.lookAt(-800,5,-500);
 layer.update(0,{x:0,z:0},false,false,camera);
 assert.deepEqual(imported.accepted,['front'],'behind-camera trees cannot consume the original-model budget');
 assert.equal(layer.group.userData.importedRadius,125);assert.equal(layer.group.userData.visibleTrunks,11);
 camera.lookAt(-800,5,-300);layer.update(.3,{x:0,z:0},false,false,camera);
 assert.equal(imported.accepted.length,8);assert.ok(imported.accepted.every(id=>id.startsWith('behind-')),'turning at the same position refreshes visibility');
 layer.update(.31,{x:0,z:0},true,false,camera);assert.equal(imported.accepted.length,3);assert.equal(layer.group.userData.importedRadius,75);
 for(const b of batches){b.wood.dispose();b.leaves.dispose();b.wood.geometry.dispose();b.leaves.geometry.dispose();b.wood.material.dispose();b.leaves.material.dispose();}
});

test('solo canopy culls only distant offscreen fallbacks and refreshes after a quick portrait pan',async()=>{
 const policy=await import('../webapp/src/games/tirana-street-life/treeLodPolicy.mjs');
 const {MatureTreeLayer}=load('../tirana-street-life/MatureTreeLayer.ts',{
  three:T,'./treeLodPolicy.mjs':policy,'./ImportedTreeLayer':{},'./DistantBroadleafLayer':{},'./loadCompactTree':{},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{},'./canopyRegistry.mjs':{},'./streetModels.mjs':{},'../tirana-street-detail/roadDetailCore.mjs':{}
 });
 const tree=(id,x,z)=>({id,x,z,y:.12,shape:'umbrella',height:10,crown:8,seed:1,zone:'test'});
 const trees=[tree('near-behind',0,28),tree('near-front',0,-45),tree('far-front',0,-160),tree('far-behind',0,160),tree('edge',28,-160)];
 const group=new T.Group();group.position.set(-800,0,-400);
 const newImported=()=>({ready:false,request(){},begin(){},add(){return false},end(){}});
 const batches=[0,1,2].map(lod=>({shape:'umbrella',lod,wood:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),10),leaves:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),10)}));
 const layer=Object.assign(Object.create(MatureTreeLayer.prototype),{cullFarTrees:true,group,dead:false,last:-Infinity,imported:newImported(),mediumImported:newImported(),importedReady:false,mediumReady:false,mediumIds:new Set(),near:()=>trees,batches,dummy:new T.Object3D(),color:new T.Color(),viewer:{x:Infinity,z:Infinity},cameraMatrix:new T.Matrix4(),cameraProjection:new T.Matrix4(),frustum:new T.Frustum(),projection:new T.Matrix4(),treeBounds:new T.Sphere()});
 const camera=new T.PerspectiveCamera(55,9/16,.1,2000);
 camera.position.set(-800,5,-400);camera.lookAt(-800,5,-500);
 layer.update(0,{x:0,z:0},false,false,camera);
 assert.equal(batches[0].wood.count,2,'near offscreen silhouettes can still cast shadows');
 const centres=batch=>Array.from({length:batch.wood.count},(_,i)=>{
  const m=new T.Matrix4();batch.wood.getMatrixAt(i,m);return [m.elements[12],m.elements[14]];
 });
 assert.deepEqual(centres(batches[1]),[[0,-160],[28,-160]]);
 assert.equal(group.userData.frustumCulledTrunks,1);
 camera.lookAt(-800,5,-300);
 layer.update(.05,{x:0,z:0},false,false,camera);
 assert.deepEqual(centres(batches[1]),[[0,160]],'big pan bypasses 200 ms update cadence');
 assert.equal(batches[0].wood.count,2);
 assert.equal(group.userData.frustumCulledTrunks,2);
 layer.cullFarTrees=false;
 layer.update(.06,{x:0,z:0},false,true,camera);
 assert.equal(batches[1].wood.count,3,'legacy modes are unchanged');
 for(const b of batches){b.wood.dispose();b.leaves.dispose();b.wood.geometry.dispose();b.leaves.geometry.dispose();b.wood.material.dispose();b.leaves.material.dispose();}
});

test('original broadleaf cutout falls back while loading or failed, preserves tree scale and never replaces cypress',async()=>{
 const {DistantBroadleafLayer}=load('../tirana-street-life/DistantBroadleafLayer.ts',{three:T});
 const tree={shape:'umbrella',x:17,z:-61,y:.2,height:9,crown:7,seed:0};
 const eye={x:17,z:0};
 let done,requests=0;
 const layer=new DistantBroadleafLayer(()=>{requests++;return new Promise(resolve=>{done=resolve;});});
 layer.request();layer.request();assert.equal(requests,1);
 assert.equal(layer.add(tree,eye),false);assert.equal(layer.mesh.count,0);
 const texture=new T.Texture();
 done(texture);await settle();
 assert.equal(layer.ready,true);
 assert.equal(texture.colorSpace,T.SRGBColorSpace);
 assert.equal(layer.add({...tree,shape:'column'},eye),false);
 assert.equal(layer.add(tree,eye),true);
 const matrix=new T.Matrix4();
 layer.mesh.getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[12]-17)<1e-5);
 assert.ok(Math.abs(matrix.elements[13]-(.2+9/2))<1e-5);
 assert.ok(Math.abs(matrix.elements[14]+61)<1e-5);
 assert.ok(Math.abs(matrix.elements[0]-7*219/211)<1e-5);
 layer.end();assert.equal(layer.mesh.instanceMatrix.version,1);
 layer.begin();assert.equal(layer.mesh.count,0);
 layer.dispose();assert.equal(layer.ready,false);
 const failed=new DistantBroadleafLayer(async()=>{throw Error('offline')});
 failed.request();await settle();
 assert.equal(failed.ready,false);assert.equal(failed.add(tree,eye),false);
 failed.dispose();
});

test('late distant canopy response releases its texture without reviving a disposed scene',async()=>{
 const {DistantBroadleafLayer}=load('../tirana-street-life/DistantBroadleafLayer.ts',{three:T});
 const texture=new T.Texture();let complete,released=0;
 texture.addEventListener('dispose',()=>released++);
 const layer=new DistantBroadleafLayer(()=>new Promise(resolve=>{complete=resolve;}));
 layer.request();layer.dispose();complete(texture);await settle();
 assert.equal(layer.ready,false);assert.equal(released,1);
});

test('solo LOD refreshes when the cutout arrives without movement and preserves a single owner',async()=>{
 const policy=await import('../webapp/src/games/tirana-street-life/treeLodPolicy.mjs');
 const {MatureTreeLayer}=load('../tirana-street-life/MatureTreeLayer.ts',{
  three:T,'./treeLodPolicy.mjs':policy,'./ImportedTreeLayer':{},'./DistantBroadleafLayer':{},'./loadCompactTree':{},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
  'three/examples/jsm/utils/BufferGeometryUtils.js':{},'./canopyRegistry.mjs':{},'./streetModels.mjs':{},'../tirana-street-detail/roadDetailCore.mjs':{}
 });
 const {DistantBroadleafLayer}=load('../tirana-street-life/DistantBroadleafLayer.ts',{three:T});
 const tree=(id,z,shape='garden')=>({id,x:0,y:.12,z,shape,height:10,crown:8,seed:1,zone:'test'});
 const trees=[tree('close',-32),tree('medium',-92),tree('far',-170),tree('cypress',-180,'column')];
 const group=new T.Group();group.position.set(100,0,200);
 const closeAsset={ready:false,request(){},begin(){},add(t){return this.ready&&t.id==='close';},end(){}};
 const mediumAsset={ready:false,request(){},begin(){},add(t){return this.ready&&t.id==='medium';},end(){}};
 const sharedGeom=new T.BoxGeometry(),sharedMat=new T.MeshStandardMaterial();
 const batches=['garden','column'].flatMap(shape=>[0,1,2].map(lod=>({shape,lod,wood:new T.InstancedMesh(sharedGeom,sharedMat,10),leaves:new T.InstancedMesh(sharedGeom,sharedMat,10)})));
 let finish;
 const distanceLayer=new DistantBroadleafLayer(()=>new Promise(resolve=>{finish=resolve;}));
 const layer=Object.assign(Object.create(MatureTreeLayer.prototype),{group,dead:false,last:-Infinity,imported:closeAsset,importedReady:false,mediumReady:false,mediumIds:new Set(),mediumImported:mediumAsset,near:()=>trees,batches,dummy:new T.Object3D(),color:new T.Color(),viewer:{x:Infinity,z:Infinity},cameraMatrix:new T.Matrix4(),cameraProjection:new T.Matrix4(),frustum:new T.Frustum(),projection:new T.Matrix4(),treeBounds:new T.Sphere(),distanceLayer,eye:new T.Vector3()});
 const camera=new T.PerspectiveCamera(55,9/16,.1,2000);camera.position.set(104,5,200);camera.lookAt(100,5,100);
 const viewer={x:0,z:0};
 const procedural=()=>batches.reduce((sum,b)=>sum+b.wood.count,0);
 try{
  layer.update(0,viewer,false,false,camera);
  assert.equal(procedural(),4);assert.equal(distanceLayer.mesh.count,0);
  finish(new T.Texture());await settle();
  layer.update(.01,viewer,false,false,camera);
  assert.equal(procedural(),2,'keep close 3D placeholder and cypress');
  assert.equal(distanceLayer.mesh.count,2,'intermediate and distant broadleaf have one representation');
  const m=new T.Matrix4();distanceLayer.mesh.getMatrixAt(0,m);
  assert.ok(Math.abs(m.elements[8]-Math.sin(Math.atan2(4,92)))<1e-5,'faces the camera in tree-local coordinates');
  closeAsset.ready=true;mediumAsset.ready=true;
  layer.update(.02,viewer,false,false,camera);
  assert.equal(group.userData.importedTrunks,2);
  assert.equal(distanceLayer.mesh.count,1,'medium glTF promotion removes its cutout');
  assert.equal(procedural(),1,'cypress stays procedural');
 }finally{distanceLayer.dispose();for(const b of batches){b.wood.dispose();b.leaves.dispose();}sharedGeom.dispose();sharedMat.dispose();}
});
