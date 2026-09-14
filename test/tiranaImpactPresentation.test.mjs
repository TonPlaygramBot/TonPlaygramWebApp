import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {vehicleDamageAppearance} from '../webapp/src/games/tiranastreets/street-career/vehicleDamageAppearance.mjs';
const require=createRequire(new URL('../webapp/package.json',import.meta.url)),T=require('three'),ts=require('typescript');
const module={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../webapp/src/games/tiranastreets/SurfaceImpactMarks.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:id=>id==='three'?T:{}});
const {SurfaceImpactMarks}=module.exports;
const hit=(id,more={})=>({id,at:0,kind:'hit',hitKind:'wall',x:0,y:1,z:0,nx:0,ny:0,nz:1,...more});

test('world rays report the actual wall/roof plane normal, including rotated walls',()=>{
  const world=new StreetWorld([{id:'wall',p:[[0,0],[10,0],[10,10],[0,10]],h:20}],false);
  const face=world.cast({x:-3,y:4,z:5},{x:1,y:0,z:0},10);
  assert.equal(face.kind,'wall');assert.ok(new T.Vector3(face.normal.x,face.normal.y,face.normal.z).distanceTo(new T.Vector3(-1,0,0))<1e-10);
  const top=world.cast({x:5,y:30,z:5},{x:0,y:-1,z:0},20);
  assert.equal(top.kind,'wall');assert.deepEqual(top.normal,{x:0,y:1,z:0});
  const diagonal=new StreetWorld([{id:'rotated',p:[[0,0],[10,10],[0,20],[-10,10]],h:20}],false);
  const edge=diagonal.cast({x:12,y:5,z:3},{x:-1,y:0,z:0},20);
  assert.equal(edge.kind,'wall');assert.ok(Math.abs(edge.normal.x-Math.SQRT1_2)<1e-10);assert.ok(Math.abs(edge.normal.z+Math.SQRT1_2)<1e-10);
});
test('bullet marks align to surfaces, stay bounded, skip air and expire',()=>{
  const marks=new SurfaceImpactMarks(3);
  marks.update([hit(1),hit(2),hit(3),hit(4),hit(5,{hitKind:'air'})],0,()=>undefined);
  assert.equal(marks.mesh.count,3);assert.equal(marks.marks.length,3);
  const matrix=new T.Matrix4();marks.mesh.getMatrixAt(0,matrix);
  assert.ok(Math.abs(new T.Vector3().setFromMatrixPosition(matrix).z-.014)<1e-6);
  marks.update([hit(5)],91,()=>undefined);assert.equal(marks.mesh.count,0);
  marks.reset();marks.update([hit(1)],0,()=>undefined);assert.equal(marks.mesh.count,1);
  marks.dispose();
});
test('vehicle bullet marks project onto original panels and follow translation/turning',()=>{
  const scene=new T.Scene(),car=new T.Group();scene.add(car);
  car.add(new T.Mesh(new T.BoxGeometry(2,2,4),new T.MeshStandardMaterial()));scene.updateMatrixWorld(true);
  const marks=new SurfaceImpactMarks();scene.add(marks.mesh);
  marks.update([hit(1,{hitKind:'car',objectId:'car',x:1.1,y:0,z:0,nx:1,ny:0,nz:0})],0,()=>car);
  assert.equal(marks.mesh.count,1);
  const m=new T.Matrix4();marks.mesh.getMatrixAt(0,m);const first=new T.Vector3().setFromMatrixPosition(m);
  assert.ok(Math.abs(first.x-1.012)<.001,'physics proxy is projected onto real x=1 panel');
  // beforeDraw runs before renderer.render propagates vehicle matrices.
  car.position.set(4,0,5);car.rotation.y=Math.PI/2;
  marks.update([],1,()=>car);marks.mesh.getMatrixAt(0,m);const moved=new T.Vector3().setFromMatrixPosition(m);
  assert.ok(moved.distanceTo(new T.Vector3(4,0,3.988))<.001);
  marks.update([],1,()=>car,'car');assert.equal(marks.mesh.count,0,'outside panels are hidden in the cockpit');
  car.visible=false;marks.update([],2,()=>car);assert.equal(marks.mesh.count,0);
  car.removeFromParent();marks.update([],3,()=>car);assert.equal(marks.marks.length,0);marks.dispose();
});
test('mechanically disabled paint stays recognizable; fire damage is charred',()=>{
  const ordinary=vehicleDamageAppearance({health:0,destroyed:true}),burnt=vehicleDamageAppearance({health:0,destroyed:true,exploded:true});
  assert.equal(ordinary.charred,false);assert.ok(ordinary.brightness>.8);
  assert.equal(burnt.charred,true);assert.ok(burnt.brightness<.3);
  assert.equal(vehicleDamageAppearance({health:140}).brightness,1);
});
