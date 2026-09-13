import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),require=createRequire(join(webapp,'package.json'));
const {build}=require('esbuild'),T=await import(pathToFileURL(join(webapp,'node_modules/three/build/three.module.js')));
const dir=mkdtempSync(join(webapp,'.gameplay-test-'));
after(()=>rmSync(dir,{recursive:true,force:true}));
async function bundle(path,name){const file=join(dir,name+'.mjs');await build({entryPoints:[join(webapp,'src/games',path)],outfile:file,bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});return import(pathToFileURL(file));}
const {CombatEffects}=await bundle('tiranastreets/CombatEffects.ts','effects');
const {BattlefieldVehicle}=await bundle('blackwater/BattlefieldVehicle.ts','vehicle');
const {GameEngine}=await bundle('blackwater/engine.ts','engine');
test('tracers, casings and explosions have bounded geometry and expire after combat stops',()=>{
 const scene=new T.Scene(),fx=new CombatEffects(scene),camera=new T.PerspectiveCamera();
 for(let i=0;i<500;i++){fx.shot({x:0,y:1,z:0},{x:0,y:1,z:-30});fx.explosion({x:3,y:1,z:0},8);}
 fx.update(.016,camera,[],[],false);const counts=fx.group.children.filter(o=>o instanceof T.InstancedMesh).map(o=>o.count);
 assert.ok(counts[3]>0,'ejected cases');assert.ok(counts[4]>0,'tracers');assert.ok(counts.reduce((a,b)=>a+b,0)<=600);
 fx.update(10,camera,[],[],false);assert.ok(fx.group.children.filter(o=>o instanceof T.InstancedMesh).every(o=>o.count===0));fx.dispose();assert.equal(scene.children.length,0);
});
test('fracture shader hooks are restored on disposal and effects reset without ghost cuts',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),original=material.onBeforeCompile,mesh=new T.Mesh(new T.BoxGeometry(10,20,4),material);scene.add(mesh);
 const fx=new CombatEffects(scene);fx.fracture(scene,[{x:0,y:0,z:0,radius:3}]);assert.notEqual(material.onBeforeCompile,original);
 fx.reset();fx.dispose();assert.equal(material.onBeforeCompile,original);mesh.geometry.dispose();material.dispose();
});
test('battlefield cockpit and chase cameras differ; boarding, brakes and blocked exits use real collision',()=>{
 const v=Object.create(BattlefieldVehicle.prototype),c={id:'test',model:'sedan',x:0,z:0,heading:0,speed:0,steering:0};
 Object.assign(v,{car:c,group:new T.Group(),cabin:{group:new T.Group(),update(){}},driving:false,loaded:true,available:true,view:'chase'});
 const p={x:2,z:0};assert.equal(v.toggle(p,[]),true);v.step(1/60,0,1,false,p,[]);assert.ok(c.speed>0);c.speed=12;
 assert.equal(v.toggle(p,[]),false);v.step(.1,0,0,true,p,[]);assert.ok(c.speed<12);
 const camera=new T.PerspectiveCamera();v.camera(camera,[]);const outside=camera.position.clone();v.view='cockpit';v.present();v.camera(camera,[]);assert.ok(outside.distanceTo(camera.position)>5);assert.equal(v.group.visible,false);
 c.speed=0;assert.equal(v.toggle(p,[{x:c.x,z:c.z,w:20,d:20,h:10}]),false);assert.equal(v.toggle(p,[]),true);assert.equal(v.group.visible,true);
});
test('gas, reverse and brake pointers release independently; camera changes require driving',()=>{
 const e=Object.create(GameEngine.prototype);Object.assign(e,{phase:'playing',vehicle:{driving:true,view:'chase',present(){}},vehiclePedals:new Set(),emit(){}});
 e.setVehiclePedal('gas',true);e.setVehiclePedal('brake',true);e.setVehiclePedal('gas',false);assert.equal(e.vehicleBrake,true);assert.equal(e.vehicleThrottle,0);
 e.setVehiclePedal('reverse',true);e.setVehiclePedal('gas',true);e.setVehiclePedal('gas',false);assert.equal(e.vehicleThrottle,-1);
 e.changeVehicleCamera();assert.equal(e.vehicle.view,'cockpit');e.vehicle.driving=false;e.changeVehicleCamera();assert.equal(e.vehicle.view,'cockpit');
});

test('a short shot is visible on its first rendered frame and the casing starts at the ejection port',()=>{
 const scene=new T.Scene(),fx=new CombatEffects(scene),camera=new T.PerspectiveCamera();
 fx.shot({x:0,y:1.5,z:0},{x:0,y:1.5,z:-.8},0,{x:.1,y:1.4,z:.3});fx.update(1/30,camera);
 const meshes=fx.group.children.filter(o=>o instanceof T.InstancedMesh),matrix=new T.Matrix4();
 meshes[4].getMatrixAt(0,matrix);const position=new T.Vector3(),scale=new T.Vector3(),rotation=new T.Quaternion();matrix.decompose(position,rotation,scale);
 assert.ok(scale.z>.7&&scale.z<=.8+.0001);assert.ok(position.z<0&&position.z>-.8);
 meshes[3].getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);assert.ok(position.distanceTo(new T.Vector3(.1,1.4,.3))<1e-6);
 assert.equal(meshes[3].geometry.type,'CylinderGeometry');fx.dispose();
});
test('Ludo missile impact instances are bounded and fully disappear at the end of their timeline',()=>{
 const scene=new T.Scene(),fx=new CombatEffects(scene),camera=new T.PerspectiveCamera();
 fx.consume(Array.from({length:20},(_,i)=>({id:i+1,kind:'blast',x:i,y:3,z:0,toX:i,toY:3,toZ:0,radius:11})));
 fx.update(1/60,camera);const impact=fx.group.getObjectByName('Ludo missile impacts');
 const meshes=impact.children.filter(o=>o instanceof T.InstancedMesh);assert.equal(meshes.length,13);assert.ok(meshes.every(m=>m.count===4));
 fx.update(1,camera);assert.ok(meshes.every(m=>m.count===0));fx.dispose();
});
