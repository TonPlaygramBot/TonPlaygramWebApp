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
  three:T,'./treeLodPolicy.mjs':policy,'./ImportedTreeLayer':{},'./loadCompactTree':{},'./DistantBroadleafLayer':{distanceTreeMinDistance:(_s,b)=>b?50:65,updateActiveTreeInstances:()=>{}},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
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
  three:T,'./treeLodPolicy.mjs':policy,'./ImportedTreeLayer':{},'./loadCompactTree':{},'./DistantBroadleafLayer':{distanceTreeMinDistance:(_s,b)=>b?50:65,updateActiveTreeInstances:()=>{}},'../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},
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

test('source cutouts allocate existing profiles only and retain high-quality shadow distance', async()=>{
 const textureLoads=[];
 class FakeTreeTextureLoader {loadAsync(url){textureLoads.push(url);return Promise.resolve(new T.Texture());}}
 const three={...T,TextureLoader:FakeTreeTextureLoader};
 const {distanceTreeProfiles,distanceTreeMinDistance}=load('../tirana-street-life/DistantBroadleafLayer.ts',{three});
 const profiles=distanceTreeProfiles([{shape:'garden'},{shape:'upright'},{shape:'upright'}]);
 assert.deepEqual(Array.from(profiles.map(p=>[p.profileId,p.mesh.instanceMatrix.count])),[['broadleaf',1],['upright',2]]);
 profiles.forEach(p=>p.request());await settle();
 assert.equal(textureLoads.length,2);assert.ok(textureLoads.every(url=>!/cypress/.test(url)));
 const colour=profiles[0].mesh.material.color;
 profiles[0].setSkyLight(.22);assert.equal(colour.r,.43);
 profiles[0].setSkyLight(.8);assert.ok(Math.abs(colour.r-2.65)<1e-6);
 assert.equal(profiles[0].mesh.material.fog,true);
 profiles.forEach(p=>p.dispose());
 assert.equal(distanceTreeMinDistance('upright',false),65);
 assert.equal(distanceTreeMinDistance('column',false),65);
 assert.equal(distanceTreeMinDistance('garden',false),65);
 assert.equal(distanceTreeMinDistance('upright',true),36);
 assert.equal(distanceTreeMinDistance('column',true),36);
 assert.equal(distanceTreeMinDistance('garden',true),50);
});

test('column cutout remains grounded, preserves authored thin crown and updates only active instances',async()=>{
 class FakeTreeTextureLoader {loadAsync(){return Promise.resolve(new T.Texture());}}
 const {distanceTreeProfiles}=load('../tirana-street-life/DistantBroadleafLayer.ts',{three:{...T,TextureLoader:FakeTreeTextureLoader}});
 const [column]=distanceTreeProfiles([{shape:'column'},{shape:'column'}]);
 const eye={x:0,z:0}, tree={shape:'column',x:6,y:1.2,z:-74,height:12,crown:2.4,seed:8};
 assert.equal(column.add(tree,eye),false,'retain old tree while its image is unavailable');
 column.request();await settle();
 assert.equal(column.add({...tree,shape:'garden'},eye),false);
 assert.ok(column.add(tree,eye));
 const m=new T.Matrix4(), p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
 column.mesh.getMatrixAt(0,m);m.decompose(p,q,s);
 assert.ok(Math.abs(s.x*37/45-tree.crown)<1e-5);
 assert.ok(Math.abs(s.y*207/215-tree.height)<1e-5);
 assert.ok(Math.abs(p.y-s.y/2+tree.height*4/207-tree.y)<1e-5);
 assert.equal(p.x,tree.x);assert.equal(p.z,tree.z);
 assert.equal(column.mesh.geometry.index.count,6);
 column.end();
 assert.equal(column.mesh.instanceMatrix.updateRanges.at(-1).count,16);
 column.begin();column.end();
 assert.equal(column.mesh.count,0);
 column.dispose();
});
