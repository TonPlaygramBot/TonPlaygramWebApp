import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {ClipTransitions} from '../webapp/src/games/tiranastreets-november/street-career/clipTransitions.mjs';

const assertNear=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
function rig(){
 const avatar=new T.Object3D(),mixer=new T.AnimationMixer(avatar);
 const action=(label,value)=>mixer.clipAction(new T.AnimationClip(label,1,[new T.NumberKeyframeTrack('.position[x]',[0,1],[value,value])]));
 const idle=action('idle',1),walk=action('walk',3),run=action('run',5);
 const actions=[idle,walk,run],clip=new ClipTransitions();
 const weights=()=>actions.map(a=>a.isRunning()?a.getEffectiveWeight():0);
 clip.reset(actions);
 const advance=dt=>{clip.update(dt);mixer.update(dt);};
 return {avatar,mixer,idle,walk,run,actions,clip,weights,advance};
}

test('quick idle / walk / run reversals retain the current pose and a full normalized mix',()=>{
 const {avatar,idle,walk,run,clip,weights,advance}=rig();
 const select=target=>{const before=weights();clip.select(target);assert.deepEqual(weights(),before);};
 clip.select(idle);advance(.035);assertNear(avatar.position.x,1);
 select(walk);advance(.04);assertNear(weights().reduce((a,b)=>a+b),1);
 const before=avatar.position.x;
 select(run);advance(0);assertNear(avatar.position.x,before);
 advance(.035);assertNear(weights().reduce((a,b)=>a+b),1);
 const time=walk.time;
 select(walk);assertNear(walk.time,time);
 advance(.16);assert.deepEqual(weights(),[0,1,0]);assertNear(avatar.position.x,3);
 assert.ok(!idle.isRunning()&&!run.isRunning());
});
test('a newly selected stride starts from its supplied gait phase',()=>{
 const {idle,walk,clip,advance}=rig();
 clip.select(idle);advance(.035);
 clip.select(walk,.6);assertNear(walk.time,.6);
 advance(.016);assertNear(walk.time,.616);
});
test('the same elapsed time produces the same visual weights at different frame rates',()=>{
 const result=steps=>{
  const {idle,walk,clip,weights,advance}=rig();
  clip.select(idle);advance(.01);clip.select(walk);
  for(const dt of steps) advance(dt);
  return weights();
 };
 const slow=result([.04,.04]),fast=result([.02,.02,.02,.02]);
 slow.forEach((x,i)=>assertNear(x,fast[i]));
});
