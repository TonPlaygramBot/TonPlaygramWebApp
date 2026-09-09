// Release gate using the project's real Three.js. NOT a WebGL or phone test.
// Requires installed webapp dependencies; missing dependencies are a hard error.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const requireWeb=createRequire(path.join(root,'webapp/package.json'));
const ts=requireWeb('typescript');
const entry=requireWeb.resolve('three');
const T=await import(pathToFileURL(path.join(path.dirname(entry),'three.module.js')));
assert.equal(T.REVISION,'164','Run against the pinned project Three.js revision');
const temp=mkdtempSync(path.join(root,'webapp/.tirana-upgrade-test-'));
const helper=path.join(temp,'weaponModelResources.mjs');
const code=readFileSync(path.join(root,'webapp/src/games/tiranastreets/weaponModelResources.ts'),'utf8');
writeFileSync(helper,ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
const {prepareWeaponScene,disposeWeaponResources}=await import(pathToFileURL(helper));
process.on('exit',()=>rmSync(temp,{recursive:true,force:true}));
function rigid(){const g=new T.BoxGeometry(1,1,1);g.clearGroups();return g;}
test('real Three: rigid batching keeps all vertices, UV1, colors, tangents and transforms',()=>{
 const source=new T.Group(),material=new T.MeshStandardMaterial({vertexColors:true});
 for(let i=0;i<2;i++){
  const g=rigid(),n=g.getAttribute('position').count;
  g.setAttribute('uv1',g.getAttribute('uv').clone());
  g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(n*3).fill(.5),3));
  g.setAttribute('tangent',new T.Float32BufferAttribute(new Float32Array(n*4).fill(.5),4));
  const mesh=new T.Mesh(g,material);mesh.position.x=i*4;source.add(mesh);
 }
 const result=prepareWeaponScene(source);assert.notEqual(result,source);assert.equal(result.children.length,1);
 const mesh=result.children[0];assert.equal(mesh.geometry.getAttribute('position').count,72);
 for(const key of ['uv','uv1','color','tangent'])assert.ok(mesh.geometry.getAttribute(key));
 assert.equal(mesh.material,material);assert.equal(new T.Box3().setFromObject(result).getSize(new T.Vector3()).x,5);
 disposeWeaponResources([source,result]);
});
test('real Three: multi-material groups and mirrored roots remain intact',()=>{
 for(const variant of ['multi','mirror']){
  const source=new T.Group(),g=rigid(),materials=[new T.MeshStandardMaterial(),new T.MeshStandardMaterial()];
  if(variant==='multi'){g.addGroup(0,18,0);g.addGroup(18,18,1);}
  const mesh=new T.Mesh(g,variant==='multi'?materials:materials[0]);source.add(mesh);
  if(variant==='mirror')source.scale.x=-1;
  assert.equal(prepareWeaponScene(source),source);disposeWeaponResources([source]);
 }
});
test('real Three: shared geometry, materials and maps dispose once per ownership boundary',()=>{
 const root=new T.Group(),geometry=rigid(),texture=new T.Texture(),material=new T.MeshStandardMaterial({map:texture,emissiveMap:texture});
 root.add(new T.Mesh(geometry,material),new T.Mesh(geometry,material));
 const counts={geometry:0,material:0,texture:0};
 for(const [key,value] of Object.entries({geometry,material,texture}))value.addEventListener('dispose',()=>counts[key]++);
 disposeWeaponResources([root,root]);assert.deepEqual(counts,{geometry:1,material:1,texture:1});
});
