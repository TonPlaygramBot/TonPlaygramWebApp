import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {containsPoint,distanceToPolygon} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {ROCK_REPLACEMENT_IDS,SKANDERBEG_BUILDING,resolveSkanderbegBuilding,skanderbegBuildingSolids} from '../webapp/src/games/tirana-landmarks/skanderbegBuilding.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {collisionSolids} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import far from '../webapp/src/games/tirana-landmarks/skanderbeg-building-far.mjs';

const placement=resolveSkanderbegBuilding(WORLD);
test('face building resolves to its existing mapped site between the hotel and opera, with no duplicate shells',()=>{
  assert.ok(placement);
  assert.deepEqual([...ROCK_REPLACEMENT_IDS],['1482874836','1482874842']);
  assert.ok(containsPoint(placement.x,placement.z,placement.headFootprint));
  const hotel=WORLD.buildings.find(b=>b.id==='236566876'),opera=WORLD.buildings.find(b=>b.id==='1249637844');
  assert.ok(placement.x>Math.max(...hotel.p.map(p=>p[0])));
  assert.ok(placement.z<Math.min(...opera.p.map(p=>p[1])));
  assert.equal(WORLD.buildings.find(b=>b.id===SKANDERBEG_BUILDING.headId).h,85);
  assert.equal(WORLD.buildings.find(b=>b.id==='885643062').h,135);
  assert.equal(resolveSkanderbegBuilding({buildings:[]}),null);
});

test('distant Blender silhouette retains 85 m height and fits mapped podium without road encroachment',()=>{
  let triangles=0,min=Infinity,max=-Infinity;
  for(const part of far.parts){
    assert.equal(part.positions.length,part.normals.length);
    triangles+=part.positions.length/9;
    for(let i=0;i<part.positions.length;i+=3){
      const [x,y,z]=part.positions.slice(i,i+3);
      assert.ok([x,y,z,...part.normals.slice(i,i+3)].every(Number.isFinite));
      min=Math.min(min,y);max=Math.max(max,y);
      const c=Math.cos(placement.yaw),s=Math.sin(placement.yaw);
      const wx=placement.x+x*c+z*s,wz=placement.z-x*s+z*c;
      assert.ok(distanceToPolygon(wx,wz,placement.podiumFootprint)<.03,'balcony crosses the known source site');
      assert.ok(Math.abs(Math.hypot(...part.normals.slice(i,i+3))-1)<.001);
    }
  }
  assert.equal(far.parts.length,2);assert.ok(triangles<3500);
  assert.ok(min>=0&&min<.12);assert.equal(max,85);
});

test('near and far GLBs are embedded, bounded, independently loadable and preserve the facial sculpture',async()=>{
  for(const level of ['near','far']){
    const data=await readFile(new URL(`../webapp/public/assets/tirana-streets/skanderbeg-building/skanderbeg-building-${level}.glb`,import.meta.url));
    assert.equal(data.readUInt32LE(0),0x46546c67);assert.equal(data.readUInt32LE(8),data.length);
    const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
    const count=doc.meshes.reduce((s,m)=>s+m.primitives.reduce((s,p)=>s+doc.accessors[p.indices].count/3,0),0);
    assert.ok(count<(level==='near'?65000:3500));
    assert.ok(data.length<(level==='near'?4_000_000:230_000));
    assert.equal(doc.buffers.length,1);assert.equal(doc.buffers[0].uri,undefined);
    assert.equal(doc.images,undefined);
    const needed=['porcelain','recessed-glazing'];
    if(level==='near')needed.push('gradient-low','gradient-high','balcony-led','leaves');
    for(const name of needed)assert.ok(doc.materials.some(m=>m.name===name),name);
  }
});

const temp=await mkdtemp(join(tmpdir(),'tirana-rock-'));
let api;
try{
  const out=join(temp,'runtime.mjs');
  await build({stdin:{contents:"export * as T from 'three';export {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';export {SkanderbegBuildingLayer} from './src/games/tirana-landmarks/SkanderbegBuildingLayer';",resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},outfile:out,bundle:true,platform:'node',format:'esm'});
  api=await import(pathToFileURL(out).href);
}finally{await rm(temp,{recursive:true,force:true});}

test('network-free mode keeps the same complete sculpture from ground to flying range; disposal is idempotent',()=>{
  const layer=new api.SkanderbegBuildingLayer(false);
  const geometries=new Set(),materials=new Set();let disposed=0;
  layer.group.traverse(o=>{if(o instanceof api.T.Mesh){geometries.add(o.geometry);materials.add(o.material);}});
  for(const item of [...geometries,...materials])item.addEventListener('dispose',()=>disposed++);
  for(const battery of [false,true])for(const distance of [0,100,600,2500,5500]){
    layer.update({x:placement.x+distance,z:placement.z},battery);
    assert.equal(layer.group.children.length,1);assert.ok(layer.group.children[0].visible);
  }
  layer.dispose();layer.dispose();layer.update(placement);
  assert.equal(disposed,geometries.size+materials.size);assert.equal(layer.group.children.length,0);
});

test('actual GLTFLoader accepts both exported levels and measures the correct ground-to-roof height',async()=>{
  for(const level of ['near','far']){
    const bytes=await readFile(new URL(`../webapp/public/assets/tirana-streets/skanderbeg-building/skanderbeg-building-${level}.glb`,import.meta.url));
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const {scene}=await new api.GLTFLoader().parseAsync(buffer,'');
    const bounds=new api.T.Box3().setFromObject(scene);
    assert.ok(Math.abs(bounds.max.y-85)<.001);assert.ok(bounds.min.y>=0&&bounds.min.y<.12);
    assert.ok(scene.children.length<=8);
  }
});

test('game physics hits the actual Blender facade at pedestrian, balcony and flight heights',async()=>{
  const bytes=await readFile(new URL('../webapp/public/assets/tirana-streets/skanderbeg-building/skanderbeg-building-near.glb',import.meta.url));
  const {scene}=await new api.GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  scene.position.set(placement.x,placement.groundY,placement.z);scene.rotation.y=placement.yaw;scene.updateMatrixWorld(true);
  const generated=skanderbegBuildingSolids(WORLD),world=new StreetWorld(generated,false);
  assert.equal(collisionSolids.filter(b=>String(b.id).startsWith('skanderbeg-building:')).length,generated.length);
  assert.ok(!collisionSolids.some(b=>ROCK_REPLACEMENT_IDS.has(String(b.id))));
  assert.equal(generated.filter(b=>b.minHeight<1.8).length,1,'overhead balconies must not enter ground-only collisions');
  for(const height of [1.5,3.3,4,8,12,32,55,64,84])for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const origin=new api.T.Vector3(placement.x-dx*55,height,placement.z-dz*55),direction=new api.T.Vector3(dx,0,dz);
    const visible=new api.T.Raycaster(origin,direction,0,110).intersectObject(scene,true)[0];
    assert.ok(visible,`missing rendered facade at height ${height}`);
    const physical=world.cast(origin,direction,110);
    assert.equal(physical.kind,'wall');
    assert.ok(Math.abs(physical.distance-visible.distance)<.09,`height ${height}, direction ${dx},${dz}: physics ${physical.distance} vs visible ${visible.distance}`);
    if(height===1.5){
      const before={x:visible.point.x-dx*.7,y:.08,z:visible.point.z-dz*.7};
      assert.ok(world.clearance(before,1.75,.34),'invisible exterior barrier');
      const inside={x:visible.point.x+dx*.5,y:.08,z:visible.point.z+dz*.5};
      assert.ok(!world.clearance(inside,1.75,.34),'walk-through visible glazing');
    }
  }
});
