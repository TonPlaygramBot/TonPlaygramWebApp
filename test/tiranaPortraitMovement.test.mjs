import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cancelActions,createBody,MOTOR,stepMotor} from '../webapp/src/games/tiranastreets-november/street-career/playerCore.mjs';

const dt=1/60;
const flat={
  move(q,x,z){q.x+=x;q.z+=z;},
  clearance(){return true;},
  surface(){return 0;},
};
function setup(yaw=0) {
  const state={elapsed:0},p={x:0,z:0},b=createBody(yaw);
  b.y=0;
  return {p,b,step(x,y,h=yaw) {
    state.elapsed+=dt;
    stepMotor(state,p,b,{x,y,yaw:h,pitch:0},dt,flat,()=>{},()=>{});
  }};
}
function close(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);}

test('stick acceleration is invariant under either thumb direction or camera yaw',()=>{
  const forward=setup(), diagonal=setup(), turned=setup(Math.PI/4);
  const n=Math.SQRT1_2;
  for(let i=0;i<24;i++){
    forward.step(0,1);
    diagonal.step(n,n);
    turned.step(0,1);
    close(forward.p.speed,diagonal.p.speed);
    close(forward.p.speed,turned.p.speed);
    close(forward.p.speed,Math.min(MOTOR.run,(i+1)*MOTOR.accel*dt));
  }
});
test('release braking has the same stopping time and distance in any direction',()=>{
  const forward=setup(), diagonal=setup();
  for(let i=0;i<30;i++){
    forward.step(0,1);
    diagonal.step(Math.SQRT1_2,Math.SQRT1_2);
  }
  const initial=[forward.p.x,forward.p.z,diagonal.p.x,diagonal.p.z];
  for(let i=0;i<25;i++){
    forward.step(0,0);diagonal.step(0,0);
    close(forward.p.speed,diagonal.p.speed);
    close(forward.p.speed,Math.max(0,MOTOR.run-(i+1)*MOTOR.brake*dt));
  }
  close(Math.hypot(forward.p.x-initial[0],forward.p.z-initial[1]),Math.hypot(diagonal.p.x-initial[2],diagonal.p.z-initial[3]));
});
test('hard stick reversal and 90-degree camera moves respect acceleration cap',()=>{
  const rig=setup();
  for(let i=0;i<30;i++)rig.step(0,1);
  for(const target of [[0,-1,0],[0,1,Math.PI/2],[1,0,Math.PI/4]]){
    const {vx,vz}=rig.b;
    rig.step(...target);
    assert.ok(Math.hypot(rig.b.vx-vx,rig.b.vz-vz)<=MOTOR.accel*dt+1e-9);
  }
});
test('full square-gate diagonals normalize and analog half-tilt stays half-speed',()=>{
  const full=setup(), half=setup();
  for(let i=0;i<60;i++){full.step(1,1);half.step(0,.5);}
  close(full.p.speed,MOTOR.run);
  close(half.p.speed,MOTOR.run/2);
});
test('pose velocity follows wall-sliding displacement, not blocked stick intent',()=>{
  const state={elapsed:dt}, p={x:0,z:0}, b=createBody();
  b.y=0;
  const wall={...flat,move(q,_x,z){q.z+=z;}};
  stepMotor(state,p,b,{x:1,y:1,yaw:0,pitch:0},dt,wall,()=>{},()=>{});
  assert.ok(b.vx>.1, 'stick still commands motion against the wall');
  close(b.travelX,0);
  close(b.travelZ,p.z/dt);
  close(Math.hypot(b.travelX,b.travelZ),p.speed);
  cancelActions(p,b);
  close(b.travelX,0); close(b.travelZ,0);
  b.travelX=1;b.travelZ=2;b.interaction='driving';
  stepMotor(state,p,b,{x:1,y:1,yaw:0,pitch:0},dt,wall,()=>{},()=>{});
  close(b.travelX,0);close(b.travelZ,0);
});
