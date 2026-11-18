import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
let resolve,reject;
globalThis.__FacadeLoader=class{loadAsync(){return new Promise((yes,no)=>{resolve=yes;reject=no;});}};
let code=ts.transpileModule(readFileSync(new URL('../webapp/src/games/tirana-environment/RealisticFacadeLayer.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
code=code.replace(/import \{ GLTFLoader \} from [^;]+;/,"const GLTFLoader=globalThis.__FacadeLoader;");
for(const [a,b] of [['three','../webapp/node_modules/three/build/three.module.js'],['./realisticFacadeLayout.mjs','../webapp/src/games/tirana-environment/realisticFacadeLayout.mjs']])code=code.replace(`'${a}'`,JSON.stringify(new URL(b,import.meta.url).href));
const {RealisticFacadeLayer,updateFacadeFallback,updateFacadeShell}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const world={buildings:[{id:'runtime-fixture',h:12,p:[[0,0],[12,0],[12,9],[0,9]]}]};
function source(){const scene=new T.Group();for(const name of ['window_small_01','window_small_03','window_large_01','door_small_02']){const group=new T.Group();group.name=name;group.add(new T.Mesh(new T.BoxGeometry(3,3,.2).translate(0,1.5,0),new T.MeshStandardMaterial({map:new T.Texture()})));scene.add(group);}return scene;}
test('loaded PBR geometry is instanced near viewer and fallback remains until ready',async()=>{
 const layer=new RealisticFacadeLayer(world,new Set());layer.update({x:0,z:0},false);assert.equal(layer.activeIds.size,0);
 const scene=source();resolve({scene});await layer.ready;layer.update({x:0,z:0},false);
 assert.equal(layer.activeIds.size,1);assert.equal(layer.group.children.length,4);
 assert.equal(layer.group.children[0].material,scene.children[0].children[0].material);
 assert.ok(layer.group.children.reduce((n,m)=>n+m.count,0)<=480);
 const version=layer.version;layer.update({x:0,z:0},false);assert.equal(layer.version,version);
 layer.update({x:1000,z:1000},false);assert.equal(layer.activeIds.size,0);
 layer.dispose();layer.dispose();assert.equal(layer.group.children.length,0);
});
test('failed loads and late results after unmount leave complete fallback and dispose resources',async()=>{
 const failed=new RealisticFacadeLayer(world,new Set());reject(new Error('offline'));await failed.ready;failed.update({x:0,z:0},false);assert.equal(failed.activeIds.size,0);assert.match(failed.group.userData.assetError,/offline/);
 const late=new RealisticFacadeLayer(world,new Set()),scene=source();let disposed=0;scene.children[0].children[0].geometry.addEventListener('dispose',()=>disposed++);
 late.dispose();resolve({scene});await late.ready;assert.equal(disposed,1);assert.equal(late.group.children.length,0);
});

test('fallback masks only active building instances and restores exact matrices repeatedly',()=>{
 const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),3),saved=new Map();
 const matrices=[0,1,2].map(i=>new T.Matrix4().makeTranslation(i*3,2,5));matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
 const read=i=>{const m=new T.Matrix4();mesh.getMatrixAt(i,m);return m;};
 for(let pass=0;pass<3;pass++){
  updateFacadeFallback(mesh,['a','b','a'],new Set(['a']),saved);assert.equal(saved.size,2);assert.equal(read(0).determinant(),0);assert.deepEqual(read(1).elements,matrices[1].elements);
  updateFacadeFallback(mesh,['a','b','a'],new Set(['b']),saved);assert.equal(saved.size,1);assert.deepEqual(read(0).elements,matrices[0].elements);
  updateFacadeFallback(mesh,['a','b','a'],new Set(),saved);assert.equal(saved.size,0);matrices.forEach((m,i)=>assert.deepEqual(read(i).elements,m.elements));
 }
});

test('active source recesses clear solid side walls while roof and collision source stay untouched',()=>{
 const geometry=new T.BoxGeometry(12,12,9),positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 const original=new Float32Array(positions.array),saved=new Map(),ranges=[{id:'a',start:0,count:positions.count}];
 for(let pass=0;pass<3;pass++){
  updateFacadeShell(geometry,ranges,new Set(['a']),saved);
  for(let i=0;i<positions.count;i++){
   assert.equal(positions.getY(i),original[i*3+1]);
   const wall=Math.abs(normals.getY(i))<.5;
   assert.ok(Math.abs(positions.getX(i)-(original[i*3]-(wall?normals.getX(i)*.30:0)))<1e-5);
   assert.ok(Math.abs(positions.getZ(i)-(original[i*3+2]-(wall?normals.getZ(i)*.30:0)))<1e-5);
  }
  updateFacadeShell(geometry,ranges,new Set(),saved);assert.equal(saved.size,0);assert.deepEqual(positions.array,original);
 }
});
