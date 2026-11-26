import * as T from 'three';
import {expect,test,vi} from 'vitest';
import {StreetRenderer} from './StreetRenderer';
const present=(StreetRenderer.prototype as any).presentFirstPerson;
test('steady camera skips projection work, cockpit near/FOV changes still reach the matrix',()=>{
  const camera=new T.PerspectiveCamera(74,390/844,.15,600);
  const updates=vi.spyOn(camera,'updateProjectionMatrix');
  const player={x:0,z:0,carId:null};
  const state={players:{local:player},cars:[{id:'car',model:'tirana-bus',x:0,z:0,speed:0,heading:0}]};
  const rig={camera,vehicleView:'chase',eyeView:true,yaw:0,pitch:0,settings:{fov:74},
    simulation:{body:{y:0,eye:1.7},flight:{},access:{parachute:{open:false}}},
    airMobility:{},followCamera:{reset(){}},bodyRig:{setEyeView(){}}};
  for(let i=0;i<60;i++) present.call(rig,state,'local',1/60);
  expect(updates).toHaveBeenCalledTimes(0);
  rig.vehicleView='cockpit'; (player as any).carId='car';
  present.call(rig,state,'local',1/60);
  expect(camera.near).toBe(.035);
  expect(updates).toHaveBeenCalledTimes(1);
  for(let i=0;i<75;i++) present.call(rig,state,'local',1/60);
  expect(camera.fov).toBe(78);
  updates.mockClear();
  for(let i=0;i<60;i++) present.call(rig,state,'local',1/60);
  expect(updates).toHaveBeenCalledTimes(0);
  (player as any).carId=null;
  present.call(rig,state,'local',1/60);
  expect(camera.near).toBe(.15);
  expect(updates).toHaveBeenCalledTimes(1);
});
