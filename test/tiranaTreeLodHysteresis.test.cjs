const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const web = require('node:module').createRequire(path.resolve(__dirname,'../webapp/package.json'));
const ts = web('typescript'), T = web('three');
function load(file,deps={}){
 const module={exports:{}};
 const source=fs.readFileSync(path.resolve(__dirname,'../webapp/src/games/tirana-street-life',file),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
  module,exports:module.exports,require:id=>id==='three'?T:deps[id],
 });
 return module.exports;
}
const distant=load('DistantBroadleafLayer.ts');

test('outbound tree threshold adds six metres, inbound shadow distances remain unchanged',()=>{
 for(const [shape,battery,at] of [['garden',false,65],['upright',true,36],['column',true,36],['umbrella',true,50]]){
  assert.equal(distant.distanceTreeMinDistance(shape,battery),at);
  assert.equal(distant.distanceTreeMinDistance(shape,battery,true),at);
  assert.equal(distant.distanceTreeMinDistance(shape,battery,false),at+6);
 }
});

test('actual MatureTreeLayer switches at most twice through eight threshold oscillations and still restores near shadow geometry',()=>{
 const {MatureTreeLayer}=load('MatureTreeLayer.ts',{
  './DistantBroadleafLayer':distant,'./treeLodPolicy.mjs':{},'./ImportedTreeLayer':{},'./loadCompactTree':{},
  '../tiranastreets/shared/urbanBounds.mjs':{},'../tirana-east/terrainCore.mjs':{},'../tirana-street-detail/roadDetailCore.mjs':{},
  './canopyRegistry.mjs':{},'./streetModels.mjs':{},'three/examples/jsm/utils/BufferGeometryUtils.js':{},
 });
 for(const [battery,threshold] of [[true,36],[false,65]]){
  const g=new T.Group(), tree={id:'t',x:0,y:0,z:0,height:12,crown:8,shape:'upright',seed:1,zone:'test'};
  const near=()=>[tree];
  const meshes=[0,1,2].map(lod=>({
   shape:'upright',lod,wood:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),3),
   leaves:new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),3),
  }));
  const noImport={ready:false,begin(){},end(){}};
  const card={ready:true,mesh:{count:0},setSkyLight(){},request(){},begin(){this.mesh.count=0;},end(){},add(){this.mesh.count++;return true;}};
  const layer=Object.assign(Object.create(MatureTreeLayer.prototype),{
   group:g,dead:false,last:-Infinity,viewer:{x:Infinity,z:Infinity},batches:meshes,near,imported:noImport,mediumImported:noImport,mediumIds:new Set(),
   dummy:new T.Object3D(),color:new T.Color(),cameraProjection:new T.Matrix4(),cameraMatrix:new T.Matrix4(),projection:new T.Matrix4(),
   frustum:new T.Frustum(),treeBounds:new T.Sphere(),eye:new T.Vector3(),distanceLayers:[card],cullFarTrees:true,
  });
  const camera=new T.PerspectiveCamera(50,390/844,.1,2300);
  const run=([offset,expected],i)=>{
   const z=-(threshold+offset);
   camera.position.set(0,1.6,z);camera.lookAt(0,6,0);camera.updateMatrixWorld(true);
   layer.update(i*.25,{x:0,z},battery,true,camera);
   assert.equal(Boolean(card.mesh.count),expected);
   assert.equal(meshes.reduce((sum,m)=>sum+m.wood.count,0),Number(!expected));
  };
  [[-1,false],[1,false],[-1,false],[2,false],[-1,false],[6,true],[1,true],[3,true],[-1,false],[2,false]].forEach(run);
 }
});
