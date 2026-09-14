import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import {load,T} from '../webapp/scripts/vehicle-wheels/loadAsset.mjs';
import {BIKE_TYPES} from '../webapp/src/games/tiranastreets/shared/bikeCatalog.mjs';
import {VEHICLE_COLLECTION} from '../webapp/src/games/tiranastreets/shared/vehicleCollection.mjs';
const temp=new URL('../webapp/node_modules/.cache/rolling-wheel-test.mjs',import.meta.url);
mkdirSync(new URL('.',temp),{recursive:true});
buildSync({entryPoints:[fileURLToPath(new URL('../webapp/src/games/tiranastreets/rollingWheels.ts',import.meta.url))],outfile:fileURLToPath(temp),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {prepareModelWheels,prepareBusWheels,prepareLegacyWheels,collectRollingWheels,rollWheels}=await import(temp);
const {default:layouts}=await import('../webapp/src/games/tiranastreets/shared/rollingWheelRigs.mjs');
function triangles(root){let total=0;root.traverse(o=>{if(o instanceof T.Mesh)total+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});return total;}
function materialSet(root){const m=new Set();root.traverse(o=>{if(o instanceof T.Mesh)for(const material of Array.isArray(o.material)?o.material:[o.material])m.add(material);});return m;}
function staticMeshes(root){const meshes=[];root.traverse(o=>{if(!(o instanceof T.Mesh))return;for(let p=o;p;p=p.parent)if(p.userData.rollingWheel)return;meshes.push([o,o.matrixWorld.clone()]);});return meshes;}
function positionsAlongAxle(wheel){
 const values=[],point=new T.Vector3();wheel.pivot.updateWorldMatrix(true,true);
 const center=wheel.pivot.getWorldPosition(new T.Vector3()),axis=wheel.axis.clone().transformDirection(wheel.pivot.matrixWorld);
 wheel.pivot.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/20)))values.push(point.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).sub(center).dot(axis));});return values;
}
for(const asset of [...BIKE_TYPES,...VEHICLE_COLLECTION])test(`${asset.id}: original geometry, centered axles, forward/reverse and static body`,async()=>{
 const path=new URL('../webapp/public'+asset.url,import.meta.url),layout=layouts[asset.id];
 assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),layout.sha256,'manifest must match exact source asset');
 const root=await load(path),count=triangles(root),materials=materialSet(root),before=new T.Box3().setFromObject(root,true);
 // Ensure every source triangle is assigned exactly once, including body parts.
 for(const partition of Object.values(layout.meshes)){let next=0;for(const [start,length,id]of partition.runs){assert.equal(start,next);assert.ok(length>0);assert.ok(id>=-1&&id<layout.wheels.length);next+=length;}assert.equal(next,partition.triangles);}
 prepareModelWheels(root,asset.id);root.updateMatrixWorld(true);
 assert.equal(root.userData.wheelRigWarning,undefined);
 assert.equal(triangles(root),count);assert.deepEqual(materialSet(root),materials);
 const after=new T.Box3().setFromObject(root,true);assert.ok(before.min.distanceTo(after.min)<1e-5);assert.ok(before.max.distanceTo(after.max)<1e-5);
 const wheels=collectRollingWheels(root);assert.equal(wheels.length,BIKE_TYPES.includes(asset)?2:4);assert.ok(wheels.every(w=>w.pivot.children.length>0&&w.radius>.2&&w.radius<.6));
 const staticParts=staticMeshes(root),centers=wheels.map(w=>w.pivot.position.clone()),axleSamples=wheels.map(positionsAlongAxle);
 // A quarter turn must not move any vertex along its axle: the original
 // rotateZ-on-a-Blender-cylinder regression tilts every tire and fails this.
 rollWheels(wheels,1,.21);root.updateMatrixWorld(true);
 wheels.forEach((w,i)=>{assert.ok(w.pivot.position.distanceTo(centers[i])<1e-9);positionsAlongAxle(w).forEach((p,j)=>assert.ok(Math.abs(p-axleSamples[i][j])<1e-5));});
 for(const [mesh,matrix]of staticParts)assert.deepEqual(mesh.matrixWorld.elements,matrix.elements,'body, calipers, forks and handlebars stay attached');
 rollWheels(wheels,-1,.21);wheels.forEach(w=>assert.ok(w.pivot.quaternion.angleTo(w.rest)<1e-6,'reverse returns the complete wheel assembly to rest'));
 const forward=BIKE_TYPES.includes(asset)?new T.Vector3(0,0,1):new T.Vector3(1,0,0);
 // Bottom tread travels opposite the vehicle; both left/right wheels share
 // the correct rolling direction regardless of the camera/vehicle yaw.
 for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  root.rotation.y=yaw;root.updateMatrixWorld(true);
  const worldForward=forward.clone().transformDirection(root.matrixWorld);
  for(const wheel of wheels){
   const marker=new T.Object3D();marker.position.set(0,-wheel.radius,0);wheel.pivot.add(marker);root.updateMatrixWorld(true);const a=marker.getWorldPosition(new T.Vector3());
   rollWheels([wheel],1,.0001);root.updateMatrixWorld(true);const travel=marker.getWorldPosition(new T.Vector3()).sub(a).normalize();assert.ok(travel.dot(worldForward)<-.8,`${asset.id} wheel tread must counteract travel`);
   rollWheels([wheel],-1,.0001);marker.removeFromParent();
  }
 }
});
test('articulated bus rotates each tire, rim and eight bolts together under its own axle',async()=>{
 const root=await load(new URL('../webapp/public/assets/tirana-streets/population/tirana-articulated-bus.glb',import.meta.url)),count=triangles(root);
 prepareBusWheels(root);const wheels=collectRollingWheels(root);assert.equal(wheels.length,6);assert.equal(triangles(root),count);
 for(const w of wheels)assert.equal(w.pivot.children.length,10,'a complete axle includes tire, rim and eight bolts');
 const rear=root.getObjectByName('ArticulatedRear');assert.equal(wheels.filter(w=>w.pivot.parent===rear).length,2);
 rear.rotation.y=.37;root.rotation.y=-.8;root.updateMatrixWorld(true);
 const w=wheels.find(w=>w.pivot.parent===rear),bolt=w.pivot.children.find(o=>/bolt/i.test(o.name)),center=w.pivot.getWorldPosition(new T.Vector3()),before=bolt.getWorldPosition(new T.Vector3()),axis=w.axis.clone().transformDirection(w.pivot.matrixWorld);
 rollWheels([w],.51,Math.PI/2);root.updateMatrixWorld(true);const after=bolt.getWorldPosition(new T.Vector3());
 const expected=before.clone().sub(center).applyAxisAngle(axis,Math.PI/2).add(center);
 assert.ok(expected.distanceTo(after)<1e-5,'bolts orbit the hub while rear articulation remains active');assert.ok(before.distanceTo(after)>.2);
 assert.ok(w.pivot.getWorldPosition(new T.Vector3()).distanceTo(center)<1e-9);
});
test('stopped and invalid frame inputs leave wheel pose finite and unchanged',()=>{
 const root=new T.Group(),pivot=new T.Group();pivot.userData.rollingWheel={radius:.3,axis:[1,0,0]};root.add(pivot);const wheels=collectRollingWheels(root),start=pivot.quaternion.clone();
 for(const [speed,dt]of [[0,1],[10,0],[10,-1],[NaN,1],[1,Infinity]])rollWheels(wheels,speed,dt);
 assert.ok(pivot.quaternion.equals(start));
});
test('fallback road-wheel matching preserves the rear spare and cockpit wheel',()=>{
 const root=new T.Group();root.scale.setScalar(2);
 const geometry=new T.CylinderGeometry(.3,.3,.2,20);geometry.rotateZ(Math.PI/2);
 for(const name of ['wheel-front-left','wheel-front-right','wheel-back-left','wheel-back-right','wheel-back','InteriorSteeringWheel01']){
  const mesh=new T.Mesh(geometry);mesh.name=name;mesh.position.set(name.includes('left')?.5:-.5,.3,name.includes('front')?.8:-.8);root.add(mesh);
 }
 const wheels=prepareLegacyWheels(root);assert.equal(wheels.length,4);assert.equal(wheels.filter(w=>w.steer).length,2);
 wheels.forEach(w=>assert.ok(Math.abs(w.radius-.6)<1e-6,'angular speed uses rendered tire radius after model scale'));
 const spare=root.getObjectByName('wheel-back'),cockpit=root.getObjectByName('InteriorSteeringWheel01');root.updateMatrixWorld(true);const spareRest=spare.matrixWorld.clone(),cockpitRest=cockpit.matrixWorld.clone();
 rollWheels(wheels,5,.25);for(const w of wheels)if(w.steer)w.steer.rotation.y=-.2;root.updateMatrixWorld(true);
 assert.deepEqual(spare.matrixWorld.elements,spareRest.elements);assert.deepEqual(cockpit.matrixWorld.elements,cockpitRest.elements);
});
