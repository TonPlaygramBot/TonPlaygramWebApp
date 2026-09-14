import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from '@babel/parser';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { readSnookerViewMetrics } from '../scripts/read-snooker-view-metrics.mjs';

const temp=await mkdtemp(join(tmpdir(),'snooker-table-test-'));
after(()=>rm(temp,{recursive:true,force:true}));
const threePath=new URL('../webapp/node_modules/three/build/three.module.js',import.meta.url).pathname;
await build({entryPoints:[new URL('../webapp/src/pages/Games/snookerUploadedTable.ts',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',outfile:join(temp,'table.mjs'),alias:{three:threePath},external:[threePath]});
const {createUploadedSnookerMapping,fitUploadedSnookerModel,reflectUploadedSnookerCushions,uploadedPocketContains,uploadedBallFits}=await import(pathToFileURL(join(temp,'table.mjs')));
const metrics=await readSnookerViewMetrics();
const mapping=createUploadedSnookerMapping(metrics.playW,metrics.playL,metrics.ballR);
const radius=metrics.ballR;
const loader=new GLTFLoader();
loader.register(()=>({name:'TableGeometryTestTextures',loadTexture:()=>Promise.resolve(null)}));
const bytes=await readFile(new URL('../webapp/public/assets/snooker-royal/mesxwi/snooker-table.glb',import.meta.url));
const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const source=await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx',import.meta.url),'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']});
const definitions=new Map();
function walk(node){
  if (!node||typeof node!=='object')return;
  if(node.type==='VariableDeclarator'&&node.id?.name)definitions.set(node.id.name,source.slice(node.init?.start,node.init?.end));
  if(node.type==='FunctionDeclaration'&&node.id?.name)definitions.set(node.id.name,source.slice(node.start,node.end));
  for(const v of Object.values(node)){if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v);}
}
walk(ast);

test('real GLB preserves 22 table meshes, original UVs, bed height and grounded feet',()=>{
  let count=0;gltf.scene.traverse(n=>{if(n.isMesh)count++;});assert.equal(count,22);
  const model=gltf.scene.clone(true);
  const bed=model.getObjectByName('Object_107');
  const uv=Array.from(bed.geometry.attributes.uv.array);
  const fitted=fitUploadedSnookerModel(model,mapping,metrics.clothY-metrics.tableY,metrics.floorY-metrics.tableY);
  const bedBox=new THREE.Box3().setFromObject(bed);
  assert.ok(Math.abs(bedBox.max.y-(metrics.ballY-metrics.tableY-radius))<1e-5);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(fitted).min.y-(metrics.floorY-metrics.tableY))<1e-4);
  assert.deepEqual(Array.from(bed.geometry.attributes.uv.array),uv);
  assert.ok(bytes.length<12_000_000);
});

test('six cushion contours come from the actual GLB cross-section, including rounded ends',()=>{
  assert.equal(mapping.contours.length,6);
  assert.ok(mapping.contours.every(c=>c.length>20));
  const model=gltf.scene.clone(true);
  const fitted=fitUploadedSnookerModel(model,mapping,0,-60);
  const cushion=model.getObjectByName('Object_82');
  fitted.updateMatrixWorld(true);
  const positions=cushion.geometry.attributes.position, indices=cushion.geometry.index;
  const triangles=[];
  for(let i=0;i<indices.count;i+=3){
    const points=[0,1,2].map(j=>cushion.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,indices.getX(i+j))));
    triangles.push(new THREE.Triangle(...points));
  }
  const out=new THREE.Vector3();
  for(const contour of mapping.contours)for(const p of contour){
    const sample=new THREE.Vector3(p.x,radius,p.y);
    const distance=Math.min(...triangles.map(t=>t.closestPointToPoint(sample,out).distanceTo(sample)));
    assert.ok(distance<.001,`collision contour left rendered cushion by ${distance}`);
  }
});

test('all six visible mouths accept centered and angled pots without a phantom jaw',()=>{
  for(let index=0;index<6;index++)for(const angle of [-.16,0,.16])for(const speed of [.15, .7, 1.6]){
    const pocket=mapping.pockets[index];
    const direction=index<4?new THREE.Vector2(Math.sign(pocket.center.x),Math.sign(pocket.center.y)).normalize():new THREE.Vector2(Math.sign(pocket.center.x),0);
    direction.rotateAround(new THREE.Vector2(),angle);
    const ball={pos:pocket.center.clone().addScaledVector(direction,-radius*12),vel:direction.clone().multiplyScalar(radius*speed)};
    let potted=false;
    for(let step=0;step<250;step++){
      ball.pos.addScaledVector(ball.vel,.5);
      reflectUploadedSnookerCushions(ball,mapping,.96);
      if(uploadedPocketContains(mapping,index,ball.pos)){potted=true;break;}
    }
    assert.ok(potted,`pocket ${index}, angle ${angle}, speed ${speed}`);
  }
});

test('rail centers rebound, solid cloth never pots, and placements respect actual noses',()=>{
  for(const [x,y,nx,ny] of [
    [mapping.field.minX,-metrics.playL/4,1,0],[mapping.field.minX,metrics.playL/4,1,0],
    [mapping.field.maxX,-metrics.playL/4,-1,0],[mapping.field.maxX,metrics.playL/4,-1,0],
    [0,mapping.field.minY,0,1],[0,mapping.field.maxY,0,-1]
  ]){
    const normal=new THREE.Vector2(nx,ny);
    const ball={pos:new THREE.Vector2(x,y).addScaledVector(normal,radius*.8),vel:normal.clone().negate()};
    assert.ok(reflectUploadedSnookerCushions(ball,mapping,.96));
    assert.ok(ball.vel.dot(normal)>0);
    assert.equal(uploadedBallFits(mapping,new THREE.Vector2(x,y)),false);
  }
  for(const spot of Object.values(mapping.spots))assert.ok(uploadedBallFits(mapping,new THREE.Vector2(...spot)));
  for(let x=-30;x<=30;x+=3)for(let y=-70;y<=70;y+=3)
    for(let i=0;i<6;i++)assert.equal(uploadedPocketContains(mapping,i,{x,y}),false);
});

test('production constructor publishes one mapping; decorative tables cannot overwrite it',async()=>{
  const context={THREE,createUploadedSnookerMapping,fitUploadedSnookerModel,
    GLTFLoader:class{loadAsync(){return Promise.resolve(gltf);}},
    uploadedTableMapping:null,uploadedTableTemplatePromise:null,CUSHION_SEGMENTS:[],RAIL_LIMIT_X:0,RAIL_LIMIT_Y:0,
    PLAY_W:metrics.playW,PLAY_H:metrics.playL,BALL_R:radius,BALL_CENTER_Y:metrics.ballY-metrics.tableY,
    TABLE_Y:metrics.tableY,FLOOR_Y:metrics.floorY,TABLE_MODEL_OPENSOURCE_GLB_URL:'asset',console};
  vm.createContext(context);
  const create=vm.runInContext(`(${definitions.get('UploadedTable3D')})`,context);
  const scene=new THREE.Scene(),world=new THREE.Group();scene.add(world);
  const active=create(world,null,true),first=context.uploadedTableMapping;
  const decor=create(world,null,false);
  assert.equal(context.uploadedTableMapping,first);
  assert.equal(await active.group.userData.ready,true);
  assert.equal(await decor.group.userData.ready,true);
  assert.equal(active.group.userData.pockets.length,6);
  context.POCKET_IDS=['TL','TR','BL','BR','TM','BM'];
  const cameraTarget=vm.runInContext(`(${definitions.get('getPocketCenterById')})`,context);
  for(const [index,id] of context.POCKET_IDS.entries())
    assert.ok(cameraTarget(id).distanceTo(first.pockets[index].center)<1e-9);
  const reflect=vm.runInContext(`(${definitions.get('reflectRails')})`,Object.assign(context,{reflectUploadedSnookerCushions,CUSHION_RESTITUTION:.96}));
  const ball={pos:new THREE.Vector2(first.field.maxX-radius*.8,20),vel:new THREE.Vector2(1,0)};
  assert.ok(reflect(ball));assert.ok(ball.vel.x<0);
});

test('broadcast, player, overhead and replay camera logic matches September 11',async()=>{
  const expected=JSON.parse(await readFile(new URL('./fixtures/snooker-morning-cameras.json',import.meta.url),'utf8'));
  for(const [name,hash] of Object.entries(expected.functions))
    assert.equal(createHash('sha256').update(definitions.get(name)).digest('hex'),hash,`${name} diverged from ${expected.commit}`);
});
