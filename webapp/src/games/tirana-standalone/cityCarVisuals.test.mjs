import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCityCabin,cityDriverFov,prepareSedanWheels,updateCityCabin} from './cityCarVisuals.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`);
const axis=new T.Vector3(0,.18,1).normalize();

test('historical seat remains left of the road view and dash below it in both directions and layouts',()=>{
  for (const aspect of [320/568,390/844,16/9]){
    const camera=new T.PerspectiveCamera(cityDriverFov(aspect),aspect,.17,560);
    const cabin=buildCityCabin();
    assert.equal(camera.fov,aspect<.8?78:68);
    for (const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const car={x:72,z:-108,yaw,steer:0,speed:0};
      updateCityCabin(cabin,camera,car,.068);
      camera.updateMatrixWorld();cabin.group.updateMatrixWorld();
      const forward=camera.getWorldDirection(new T.Vector3());
      assert.ok(forward.dot(new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)))>.99);
      const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      close(camera.position.clone().sub(new T.Vector3(car.x,camera.position.y,car.z)).dot(right),-.38);
      close(camera.position.y,1.258);
      const wheel=cabin.wheel.getWorldPosition(new T.Vector3()).project(camera);
      const dash=cabin.group.getObjectByName('Basic dashboard').getWorldPosition(new T.Vector3()).project(camera);
      assert.ok(wheel.z>-1&&wheel.z<1&&wheel.y<0);
      assert.ok(dash.z>-1&&dash.z<1&&dash.y<-.2);
    }
  }
});

test('steering tilt, reversal, idle and saturation leave the camera and dashboard fixed',()=>{
  const camera=new T.PerspectiveCamera(78,.6,.17,560);
  const cabin=buildCityCabin();
  let anchor;
  for (const [steer,speed,angle,needle] of [
    [0,0,0,2.2],[1,11,-1.7,-2.2],[-1,-5.5,1.7,0],[50,99,-1.7,-2.2],[NaN,Infinity,0,2.2]
  ]){
    updateCityCabin(cabin,camera,{x:2,z:7,yaw:.2,steer,speed},.068);
    anchor??=camera.position.clone();
    close(camera.position.distanceTo(anchor),0);
    close(cabin.group.position.distanceTo(anchor),0);
    close(cabin.wheel.quaternion.angleTo(new T.Quaternion().setFromAxisAngle(axis,angle)),0);
    close(cabin.needle.rotation.z,needle);
  }
});

test('exterior road wheels retain separate rolling and front-only steering pivots',()=>{
  const root=new T.Group();
  for (const side of ['left','right']) for(const axle of ['front','back']){
    const part=new T.Group();part.name=`wheel-${axle}-${side}`;part.position.set(side==='left'?-1:1,.3,axle==='front'?-2:2);
    root.add(part);
  }
  const wheels=prepareSedanWheels(root);
  assert.equal(wheels.length,4);
  assert.equal(wheels.filter(w=>w.front).length,2);
  for(const w of wheels){assert.equal(w.pivot.parent,w.yaw);assert.equal(w.pivot.children.length,1);}
});
