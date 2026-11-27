import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const {Bone,Group,Quaternion,Vector3}=createRequire(new URL('../webapp/package.json',import.meta.url))('three');
import {TuriLookImpact} from '../webapp/src/games/tiranastreets-november/street-career/turiLookImpact.mjs';

function setup() {
  const rig=new Group(),chest=new Bone(),neck=new Bone(),head=new Bone();
  rig.add(chest);chest.add(neck);neck.add(head);
  const animator=new TuriLookImpact(rig,new Map([['spine2',chest],['neck',neck],['head',head]]));
  const angle=bone=>{
    const p=new Vector3(0,0,1).applyQuaternion(bone.getWorldQuaternion(new Quaternion()));
    return {yaw:Math.atan2(p.x,p.z),pitch:Math.atan2(p.y,Math.hypot(p.x,p.z))};
  };
  return (args={})=>{
    for(const b of [chest,neck,head])b.quaternion.identity();
    animator.update({enabled:true,bodyYaw:0,lookYaw:0,time:1,lastDamage:-10,dt:1/60,...args});
    return {head:angle(head),chest:angle(chest),root:rig.position.toArray()};
  };
}
test('turns both directions, clamps extreme view offsets and uses shortest signed wrap',()=>{
  const left=setup(),right=setup();let a,b;
  for(let i=0;i<30;i++){a=left({lookYaw:-2});b=right({lookYaw:2});}
  assert.ok(a.head.yaw<-.6 && a.head.yaw>-.93);
  assert.ok(b.head.yaw>.6 && b.head.yaw<.93);
  assert.ok(Math.abs(a.head.yaw+b.head.yaw)<1e-10);
  const seam=setup()({bodyYaw:3.12,lookYaw:-3.12});
  assert.ok(seam.head.yaw>0&&seam.head.yaw<.05);
});
test('gaze smoothing agrees at two frame rates and clears outside the supported pose',()=>{
  const slow=setup(),fast=setup();let a,b;
  for(let i=0;i<30;i++)a=slow({lookYaw:.8,dt:1/60});
  for(let i=0;i<60;i++)b=fast({lookYaw:.8,dt:1/120});
  assert.ok(Math.abs(a.head.yaw-b.head.yaw)<1e-10);
  assert.equal(slow({enabled:false}).head.yaw,0);
});
test('received impact fades back to neutral and never changes root position',()=>{
  const motion=setup(),rest=motion();
  const hit=motion({time:1.1,lastDamage:1});
  assert.ok(hit.chest.pitch>.11);
  assert.deepEqual(hit.root,rest.root);
  assert.deepEqual(motion({time:1.36,lastDamage:1}),rest);
  assert.deepEqual(motion({time:.9,lastDamage:1}),rest);
});
test('existing unarmed visual action has mirrored chest follow-through and ends neutral',()=>{
  const motion=setup(),rest=motion();
  const right=motion({gesture:{right:true,phase:.58}});
  const left=motion({gesture:{right:false,phase:.58}});
  assert.ok(right.chest.yaw>.2 && left.chest.yaw<-.2);
  assert.ok(Math.abs(right.chest.yaw+left.chest.yaw)<1e-10);
  assert.deepEqual(motion({gesture:{right:true,phase:1}}),rest);
});

test('neutral held-loadout looking changes head and neck only',()=>{
  const motion=setup();
  const moving=motion({glanceOnly:true,lookYaw:.7,time:1.1,lastDamage:1,gesture:{right:true,phase:.58}});
  assert.ok(moving.head.yaw>.1);
  assert.equal(moving.head.pitch,0);
  assert.deepEqual(moving.chest,{yaw:0,pitch:0});
  assert.deepEqual(moving.root,[0,0,0]);
});
