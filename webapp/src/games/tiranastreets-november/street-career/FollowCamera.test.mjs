import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PerspectiveCamera} from 'three';
import {FollowCamera} from './FollowCamera.ts';
const portrait = 390 / 844;
const frame=(rig, camera, cast, key='car:compact:chase', dt=1/60, anchor={x:0,y:1.25,z:0})=>{
  rig.update(camera,{key,anchor,yaw:0,pitch:0,lookPitch:0,distance:6,dt,cast,ground:()=>0});
  return camera.position.distanceTo(anchor);
};
const camera=(aspect=portrait)=>new PerspectiveCamera(74,aspect,.15,600);
const pillar=(origin,direction,distance)=>direction.z>0&&Math.abs(origin.x-.227)<.008?2:distance;
const approx=(got,want)=>assert.ok(Math.abs(got-want)<1e-7,`${got} != ${want}`);
test('portrait no longer snaps forward beside a pillar outside the padded view',()=>{
  const after=frame(new FollowCamera(),camera(),pillar);
  approx(after,6);
});
test('portrait still stops for an actual right/left corner obstruction',()=>{
  for(const sign of [-1,1]){
    const wall=(origin,direction,distance)=>sign*origin.x>.16&&direction.z>0?2:distance;
    approx(frame(new FollowCamera(),camera(),wall),1.8);
  }
});
test('actual landscape corner obstruction is retained',()=>{
  const wall=(origin,direction,distance)=>origin.x>.29&&direction.z>0?2:distance;
  approx(frame(new FollowCamera(),camera(16/9),wall),1.8);
});
test('view moves inward immediately and recovers at the same rate at 60 and 120 Hz',()=>{
  const blocked=(origin,direction,distance)=>direction.z>0?2:distance;
  const free=(origin,direction,distance)=>distance;
  const recover=(fps)=>{
    const r=new FollowCamera(), c=camera();
    approx(frame(r,c,free),6);approx(frame(r,c,blocked),1.8);
    const first=frame(r,c,free,'car:compact:chase',1/fps);
    assert.ok(first>1.8&&first<3);
    for(let i=1;i<fps/2;i++) frame(r,c,free,'car:compact:chase',1/fps);
    return c.position.z;
  };
  approx(recover(60),recover(120));
});
test('switching view does not carry the previous camera collision distance',()=>{
  const r=new FollowCamera(),c=camera();
  approx(frame(r,c,()=>2),1.8);
  approx(frame(r,c,(_o,_d,n)=>n,'car:compact:wide'),6);
});
