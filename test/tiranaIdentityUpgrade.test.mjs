import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {fixedStepBudget,nearestActors} from '../webapp/src/games/tiranastreets/shared/frameBudget.mjs';
import {createState,advanceState,collide,WORLD,collisionSolids} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {forcePersonBudget,forcePoseInterval} from '../webapp/src/games/tiranastreets/shared/parliamentCordon.mjs';
import {PARLIAMENT_GARDEN_TREES} from '../webapp/src/games/tirana-street-life/parliamentGarden.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {segmentDistance} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
const temporary=await mkdtemp(join(tmpdir(),'tirana-identity-test-'));
let api;
try{
 const module=join(temporary,'test.mjs');
 await build({stdin:{contents:`export * as T from 'three'; export {createForceLOD,applyForceLOD} from './src/games/tiranastreets/forceLOD'; export {updateNavigationLine,navigationLineEnd} from './src/games/tiranastreets/NavigationLine'; export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'; export {identityReliefFromImage,RELIEF_BRANDS} from './src/games/tirana-street-life/IdentityRelief'; export {raisedInstitutionName} from './src/games/tirana-city-source/RaisedInstitutionName'; export {createBrandArtworkCache} from './src/games/tirana-street-life/brandArtworkCache'; export {UrbanMonumentLayer} from './src/games/tirana-landmarks/UrbanMonumentLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,format:'esm',platform:'node',outfile:module});
 api=await import(pathToFileURL(module));
}finally{await rm(temporary,{recursive:true,force:true});}
const awaitableFont=await readFile(new URL('../webapp/src/games/tirana-city-source/institutionTypeface.json',import.meta.url),'utf8');
const dispose=root=>root.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});

test('60 Hz simulation remains deterministic across ordinary display rates and caps stalled frames',()=>{
 for(const rate of [20,30,60,90,120,144]){
  let pending=0,steps=0,dropped=0;
  for(let i=0;i<rate*10;i++){const budget=fixedStepBudget(pending,1/rate);pending=budget.remainder;steps+=budget.steps;dropped+=budget.dropped;}
  assert.equal(steps,600);assert.equal(dropped,0);assert.ok(pending<1/60);
 }
 const stalled=fixedStepBudget(.009,2);assert.equal(stalled.steps,4);assert.ok(stalled.dropped>1.9);assert.ok(Math.abs(stalled.remainder-.009)<1e-9);
 assert.equal(fixedStepBudget(NaN,Infinity).steps,0);
});

test('bounded actor selection matches an exhaustive nearest eligible oracle',()=>{
 const items=Array.from({length:2500},(_,i)=>({id:String(i),x:Math.sin(i*9.1)*220,z:Math.cos(i*7.3)*220,eligible:i%3!==0}));
 items.push({id:'invalid',x:NaN,z:0,eligible:true});
 for(const limit of [1,8,28,64])for(const viewer of [{x:0,z:0},{x:130,z:-55}]){
  const distance=e=>(e.x-viewer.x)**2+(e.z-viewer.z)**2;
  const expected=items.filter(e=>e.eligible&&distance(e)<150**2).sort((a,b)=>distance(a)-distance(b)||a.id.localeCompare(b.id)).slice(0,limit);
  assert.deepEqual(nearestActors(items,viewer,150,limit,e=>e.eligible),expected);
 }
 assert.deepEqual(nearestActors(items,{x:NaN,z:0},100,10),[]);
});

test('Parliament has four straight clear rows, two uniform types and bounded pose work',()=>{
 const state=createState([{id:'local',name:'audit'}],'free-roam','solo'),guards=state.npcs.filter(n=>n.cordon);
 assert.equal(guards.length,24);assert.deepEqual([...new Set(guards.map(g=>g.forceCharacter))].sort(),['fnsh_officer','shqiponja_officer']);
 for(const id of new Set(guards.map(g=>g.cordon))){
  const row=guards.filter(g=>g.cordon===id);assert.equal(row.length,6);
  for(let i=0;i<row.length;i++){
   const g=row[i],p={x:g.x,z:g.z};collide(p,.45);assert.ok(Math.hypot(p.x-g.x,p.z-g.z)<.05);
   assert.ok(!WORLD.roads.some(r=>!r.walk&&segmentDistance(g.x,g.z,r.a,r.b)<r.w/2+.64));
   if(i)assert.ok(Math.abs(Math.hypot(g.x-row[i-1].x,g.z-row[i-1].z)-1.1)<1e-8);
  }
 }
 const near=guards.map(entity=>({entity,distance:10}));assert.equal(forcePersonBudget(near,true),26);assert.equal(forcePersonBudget(near,false),28);
 assert.equal(forcePersonBudget([],true),8);assert.equal(forcePersonBudget(near,false,false),16);assert.equal(forcePersonBudget(near,true,false),8);assert.equal(forcePoseInterval(15,'idle',false,'front'),.05);assert.equal(forcePoseInterval(15,'fight',false,'front'),0);
 const player=state.players.local;Object.assign(player,{x:323,z:202,wanted:0,carId:null});
 const guard=guards[0];guard.x+=.45;guard.z+=.2;
 for(let i=0;i<120;i++)advanceState(state,1/60);
 assert.equal(player.wanted,0);assert.equal(player.health,100);assert.ok(Math.hypot(guard.x-guard.guardPost.x,guard.z-guard.guardPost.z)<.13);
});

test('new garden trees have one render owner, real trunk collision and clear carriageways',()=>{
 assert.equal(PARLIAMENT_GARDEN_TREES.length,16);
 for(const tree of PARLIAMENT_GARDEN_TREES){
  const owners=CANOPY_TREES.filter(t=>t.id===tree.id);assert.equal(owners.length,1);assert.equal(owners[0].x,tree.x);assert.equal(owners[0].z,tree.z);
  assert.ok(tree.sources.length===2);assert.match(tree.accuracy,/not surveyed/);
  assert.ok(collisionSolids.some(s=>s.id===tree.id));const p={x:tree.x,z:tree.z};collide(p,.45);assert.ok(Math.hypot(p.x-tree.x,p.z-tree.z)>.3);
  assert.ok(!WORLD.roads.some(r=>!r.walk&&segmentDistance(tree.x,tree.z,r.a,r.b)<r.w/2+.4));
 }
});

test('all 19 raised identities retain finite paint UVs and at most four draw calls',()=>{
 assert.equal(api.RELIEF_BRANDS.size,19);
 for(const id of api.RELIEF_BRANDS){
  const root=api.identityReliefFromImage(id,{});let meshes=0,painted=0;
  root.traverse(o=>{if(!o.isMesh)return;meshes++;
   for(const name of ['position','normal','uv'])assert.ok([...o.geometry.getAttribute(name).array].every(Number.isFinite),id+' '+name);
   if(o.material.map){painted++;const uv=o.geometry.getAttribute('uv');for(const value of uv.array)assert.ok(value>-.002&&value<1.002,id+' paint UV');}
  });
  assert.equal(meshes,4,id);assert.equal(painted,1,id);if(id==='qtu')assert.ok(root.children[2].geometry.getAttribute('position').count>300,'QTU letters must be raised independently of the opaque white background');dispose(root);
 }
});

test('Albanian school lettering fits the complete name and includes diacritics',()=>{
 const font=JSON.parse(awaitableFont);
 for(const glyph of ['ë','Ë','ç','Ç'])assert.ok(font.glyphs[glyph]);
 for(const name of ['Shkolla 9-vjeçare “Fan Noli”','Universiteti i Tiranës','Shkolla e Mesme e Bashkuar e Arteve Jordan Misja']){
  const group=api.raisedInstitutionName(name,4.6,1.15),box=new api.T.Box3().setFromObject(group);assert.ok(box.max.x-box.min.x<=4.6001);assert.ok(box.max.y-box.min.y<=1.1501);dispose(group);
 }
});

test('a stalled logo request frees the loader slot and can be retried',async()=>{
 const images=[];const cache=api.createBrandArtworkCache(1,2,()=>{const image={naturalWidth:64,naturalHeight:32};images.push(image);return image;},25);
 const stalled=cache.load('/stalled'),next=cache.load('/next');assert.equal(cache.stats().queued,1);assert.equal(await stalled,null);
 images.at(-1).onload();assert.ok(await next);assert.equal(cache.stats().active,0);
 const retry=cache.load('/stalled');images.at(-1).onload();assert.ok(await retry);
 assert.equal(cache.stats().cached,2);
});

test('shipped Blender input GLBs contain embedded artwork, valid accessors and parseable monument meshes',async()=>{
 const folder=new URL('../webapp/public/assets/tirana-streets/city-identity/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 assert.equal(Object.keys(manifest.models).length,23);
 for(const [id,model] of Object.entries(manifest.models)){
  const bytes=await readFile(new URL(model.file,folder));assert.equal(bytes.length,model.bytes);assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()),binStart=28+bytes.readUInt32LE(12),binLength=bytes.length-binStart;
  for(const view of json.bufferViews)assert.ok(view.byteOffset+view.byteLength<=binLength,id);
  for(const accessor of json.accessors){assert.ok(accessor.count>0);const v=json.bufferViews[accessor.bufferView];assert.equal(v.byteLength,accessor.count*(accessor.type==='VEC2'?2:3)*4);}
  if(model.kind==='operator-sign'){assert.equal(json.images.length,1);const view=json.bufferViews[json.images[0].bufferView];assert.equal(bytes.subarray(binStart+view.byteOffset,binStart+view.byteOffset+8).toString('hex'),'89504e470d0a1a0a');assert.ok(!json.images[0].uri);}
  else {const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);const gltf=await new api.GLTFLoader().parseAsync(buffer,'');assert.ok(gltf.scene.children.length);dispose(gltf.scene);}
 }
});


test('route changes reuse buffers and the beacon follows the drawn endpoint on slopes',()=>{
 const first=[{x:100,z:100},{x:120,z:115},{x:160,z:140}],height=(x,z)=>x*.1+z*.02;
 const line=api.updateNavigationLine(null,first,height),buffer=line.geometry.getAttribute('position'),material=line.material;
 assert.equal(line.geometry.drawRange.count,3);assert.equal(api.navigationLineEnd(line).x,160);
 const next=[{x:101,z:102},{x:111,z:112}];assert.equal(api.updateNavigationLine(line,next,height),line);
 assert.equal(line.geometry.getAttribute('position'),buffer);assert.equal(line.material,material);
 const end=api.navigationLineEnd(line);assert.equal(end.x,111);assert.ok(Math.abs(end.y-height(111,112)-.24)<1e-5);
 assert.ok(line.geometry.boundingSphere.center.x>100,'unused capacity must not pull bounds to origin');
 api.updateNavigationLine(line,[],height);assert.equal(api.navigationLineEnd(line),null);assert.equal(line.visible,false);
 const many=Array.from({length:130},(_,i)=>({x:100+i,z:100}));api.updateNavigationLine(line,many,height);
 assert.equal(line.geometry.getAttribute('position').count,256);assert.equal(api.navigationLineEnd(line).x,229);
 line.geometry.dispose();material.dispose();
});


test('cordon LOD removes over 70% of triangles while sharing original skin, paint and animation data',async()=>{
 const {createHash}=await import('node:crypto');
 for(const id of ['fnsh_officer','shqiponja_officer']){
  const folder=new URL('../webapp/public/assets/tirana-streets/albanian-forces/',import.meta.url),bytes=await readFile(new URL('glb/'+id+'.glb',folder)),patch=JSON.parse(await readFile(new URL('lod/'+id+'.json',folder),'utf8'));
  assert.equal(patch.sourceSha256,createHash('sha256').update(bytes).digest('hex'));assert.ok(patch.triangles<patch.originalTriangles*.3);
  const oldLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+oldLength));
  // Geometry/rig verification in Node omits image decoding only. The shipped
  // GLB and all runtime texture/material definitions remain untouched.
  const removeTextures=value=>{if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(key.endsWith('Texture'))delete value[key];else removeTextures(value[key]);}};
  removeTextures(json.materials);delete json.images;delete json.textures;
  const jsonBytes=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(jsonBytes.length/4)*4,32);jsonBytes.copy(padded);
  const binary=bytes.subarray(20+oldLength),header=Buffer.from(bytes.subarray(0,20));header.writeUInt32LE(20+padded.length+binary.length,8);header.writeUInt32LE(padded.length,12);
  const data=Buffer.concat([header,padded,binary]),gltf=await new api.GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const lod=api.createForceLOD(gltf,patch),originals=[];gltf.scene.traverse(o=>{if(o.isMesh)originals.push([o,o.geometry,o.material,o.skeleton]);});
  assert.equal(lod.size,patch.primitives.length);api.applyForceLOD(gltf.scene,lod,true);
  for(const [mesh,geometry,material,skeleton] of originals){assert.equal(mesh.material,material);assert.equal(mesh.skeleton,skeleton);for(const [key,attribute]of Object.entries(geometry.attributes))assert.equal(mesh.geometry.getAttribute(key),attribute);assert.ok(mesh.geometry.index.count<=geometry.index.count);}
  const mixer=new api.T.AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations.find(a=>a.name==='Walk')).play();mixer.update(.37);gltf.scene.updateMatrixWorld(true);
  for(const [mesh] of originals)if(mesh.isSkinnedMesh){mesh.skeleton.update();const vertex=mesh.getVertexPosition(mesh.geometry.index.getX(0),new api.T.Vector3());assert.ok(vertex.toArray().every(Number.isFinite));}
  api.applyForceLOD(gltf.scene,lod,false);for(const [mesh,geometry]of originals)assert.equal(mesh.geometry,geometry);
  const invalid=structuredClone(patch);invalid.primitives[0].vertices++;assert.throws(()=>api.createForceLOD(gltf,invalid),/does not match/);
  mixer.stopAllAction();dispose(gltf.scene);lod.forEach(g=>g.dispose());
 }
});
