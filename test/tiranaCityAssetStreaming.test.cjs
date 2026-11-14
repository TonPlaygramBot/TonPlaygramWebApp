const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json')),ts=web('typescript'),T=web('three');
const base=path.resolve(__dirname,'../webapp/src/games/tiranastreets');
function load(file,deps={},globals={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(base,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>{if(!(id in deps))throw Error('Missing fixture '+id);return deps[id];},console,performance,...globals});return module.exports;
}

const settle=()=>new Promise(resolve=>setImmediate(resolve));

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
