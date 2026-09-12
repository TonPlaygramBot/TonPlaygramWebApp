import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { checkCueTipAccess, isLegalCuePlacement, rotatePoolBall } from '../webapp/src/pages/Games/shared/poolRoyalShotGeometry.ts';
import { generateRackPositions, arrangePoolRack } from '../webapp/src/pages/Games/poolRoyaleRack.js';
import { normalizeSpinInput, mapSpinForPhysics } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import { advancePoolRoyalCueStroke } from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';
import { coachingDefinition, evaluateCoachingShot } from '../webapp/src/config/poolRoyalCoaching.js';
import { createOpenSnookerPlayer } from '../webapp/src/pages/Games/shared/createOpenSnookerPlayer.ts';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { resolveSafeBridgeAnchor } from '../webapp/src/pages/Games/shared/poolRoyalBridgeSafety.ts';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';

const cue = { id: 'cue', active: true, pos: { x: 0, y: 0 } };
const ball = (x, y) => ({ id: 'ball_1', active: true, pos: { x, y } });

test('all eight spin directions remain selectable at every clear aim heading', () => {
  for (let heading = 0; heading < 360; heading += 15) {
    const forward = { x: Math.cos(heading * Math.PI / 180), y: Math.sin(heading * Math.PI / 180) };
    for (let direction = 0; direction < 8; direction++) {
      const spin = { x: .7 * Math.cos(direction * Math.PI / 4), y: .7 * Math.sin(direction * Math.PI / 4) };
      assert.equal(checkCueTipAccess(cue, spin, [cue], forward, 1, .1).blocked, false);
    }
  }
});

test('only a ball intersecting the physical tip approach blocks a side', () => {
  const forward = { x: 1, y: 0 };
  const blocker = ball(-1.5, 1.45);
  assert.equal(checkCueTipAccess(cue, {x:.75,y:0}, [cue,blocker], forward, 1,.1).blocked, true);
  assert.equal(checkCueTipAccess(cue, {x:-.75,y:0}, [cue,blocker], forward, 1,.1).blocked, false);
  assert.equal(checkCueTipAccess(cue, {x:.75,y:0}, [cue,ball(2.05,0)], forward, 1,.1).blocked, false);
});

test('placement rejects overlap, pocket mouths, off-table points and headstring violations', () => {
  const bounds = {x:10,minY:-20,maxY:-10};
  const obstacles = [cue,ball(0,-15)];
  for (const point of [{x:0,y:-15},{x:1.99,y:-15},{x:11,y:-15},{x:0,y:-9},{x:NaN,y:-15}]) {
    assert.equal(isLegalCuePlacement(point,obstacles,cue,1,bounds), false);
  }
  assert.equal(isLegalCuePlacement({x:2.02,y:-15},obstacles,cue,1,bounds),true);
  assert.equal(isLegalCuePlacement({x:9,y:-19},obstacles,cue,1,bounds,[{x:10,y:-20}],2),false);
});

test('triangle and diamond racks have no overlapping pair, including the eight-ball spot anchor', async () => {
  const m = await readPoolRoyalMetrics();
  for (const radius of [.0285,.0525,m.ballR]) for (const [count,layout] of [[15,'triangle'],[9,'diamond']]) {
    const rack = generateRackPositions(count,layout,radius,8*radius,{index:4,x:0,z:12*radius});
    assert.equal(rack.length,count);
    for(let i=0;i<rack.length;i++) for(let j=i+1;j<rack.length;j++) {
      assert.ok(Math.hypot(rack[i].x-rack[j].x,rack[i].z-rack[j].z)>=2*radius,`${layout} ${i}/${j}`);
    }
    assert.deepEqual(rack[4],{x:0,z:12*radius});
  }
  for(let level=1;level<=50;level++) {
    const layout=coachingDefinition(level).layout;
    const points=[layout.cue,...layout.balls];
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) {
      assert.ok(Math.hypot((points[i].x-points[j].x)*(m.playW/2-m.ballR*2.5),
        (points[i].z-points[j].z)*(m.playL/2-m.ballR*2.5)) > m.ballR*2, `drill ${level}`);
    }
  }
});

test('low spin survives the physics mapping; centre starts with no artificial topspin', () => {
  assert.deepEqual(mapSpinForPhysics({x:0,y:0}),{x:0,y:0});
  for(const sign of [-1,1]) {
    const normalized=normalizeSpinInput({x:0,y:.3*sign});
    assert.equal(Math.sign(mapSpinForPhysics(normalized,{normalized:true}).y),sign);
    assert.ok(Math.abs(mapSpinForPhysics(normalized,{normalized:true}).y)>.12);
  }
});

test('ball orientation follows angular velocity including draw and pure sliding', () => {
  const mesh=new THREE.Object3D();
  rotatePoolBall(mesh,new THREE.Vector3(-1,0,0),{x:0,y:1},.5,1);
  assert.ok(mesh.quaternion.x<0,'draw rotates against forward rolling');
  const prior=mesh.quaternion.clone();
  rotatePoolBall(mesh,new THREE.Vector3(),{x:0,y:1},.5,1);
  assert.ok(prior.equals(mesh.quaternion),'a centre strike slides before friction starts rolling');
  for(let i=0;i<100;i++)rotatePoolBall(mesh,new THREE.Vector3(1,2,3),{x:0,y:1},.1,1);
  assert.ok(Math.abs(mesh.quaternion.length()-1)<1e-10);
});

test('a dropped render frame still displays contact once before forward follow-through', () => {
  const cueMesh=new THREE.Object3D(); let impacts=0;
  const stroke={startTime:0,pullbackDuration:0,strikeDuration:160,holdDuration:120,
    idlePos:new THREE.Vector3(0,0,-1),pullPos:new THREE.Vector3(0,0,-3),
    contactPos:new THREE.Vector3(),followPos:new THREE.Vector3(0,0,1),
    onImpact:()=>{impacts++;assert.ok(cueMesh.position.equals(stroke.contactPos));}};
  assert.equal(advancePoolRoyalCueStroke(cueMesh,stroke,1000).done,false);
  assert.equal(impacts,1);
  advancePoolRoyalCueStroke(cueMesh,stroke,1060);
  assert.ok(cueMesh.position.z>0 && cueMesh.position.z<1);
  assert.equal(advancePoolRoyalCueStroke(cueMesh,stroke,1200).done,true);
  assert.equal(impacts,1);
});

test('coaching completion depends on the requested shot and never rewards a final-ball scratch', () => {
  const base={shots:1,cue:{x:.18,z:0},pottedTargets:1,targetCount:1,scratched:false,blockerPotted:false,firstTargetHit:true,cushionBeforeContact:false,spin:{x:0,y:0}};
  assert.equal(evaluateCoachingShot(coachingDefinition(2),base).status,'complete');
  assert.equal(evaluateCoachingShot(coachingDefinition(2),{...base,cue:{x:-.7,z:.5}}).status,'retry');
  assert.equal(evaluateCoachingShot(coachingDefinition(1),{...base,scratched:true}).status,'retry');
  assert.equal(evaluateCoachingShot(coachingDefinition(6),base).status,'retry');
  assert.equal(evaluateCoachingShot(coachingDefinition(6),{...base,spin:{x:-.5,y:0}}).status,'complete');
  assert.equal(evaluateCoachingShot(coachingDefinition(8),{...base,pottedTargets:0,cushionBeforeContact:true}).status,'complete');
  assert.equal(evaluateCoachingShot(coachingDefinition(8),{...base,pottedTargets:0}).status,'playing');
});

test('bridge moves along the shaft to avoid the ball without losing lateral alignment', () => {
  const preferred=new THREE.Vector3(0,0,0), forward=new THREE.Vector3(0,0,-1);
  const safety=resolveSafeBridgeAnchor(preferred,forward,[{position:preferred,radius:1}],{halfWidth:10,halfLength:20},.5);
  assert.equal(safety.anchor.x,0);
  assert.ok(safety.anchor.distanceTo(preferred)>=1.5);
  assert.equal(safety.style,'compact');
});

test('source-generated snooker players pose independently with separate first-person heads', async () => {
  const model=createOpenSnookerPlayer('mei');
  assert.equal(model.userData.license,'MIT');
  let fingers=0;model.traverse(o=>{if(o.isBone && /Hand(?:Thumb|Index|Middle|Ring|Pinky)\d/.test(o.name))fingers++;});
  assert.equal(fingers,40);
  const players=new PoolRoyalHumanPlayers(new THREE.Scene(),{floorY:-3,clothY:4,tableW:20,tableL:32,playerProfiles:{A:'alex',B:'amara'}});
  assert.equal(await players.ready,true);
  assert.notEqual(players.players[0].human.bones.hips,players.players[1].human.bones.hips);
  for(let i=0;i<90;i++)players.update(1/60,{activeSeat:'A',state:'dragging',cueBall:new THREE.Vector3(0,4.3,8),aimForward:new THREE.Vector3(0,0,-1),power:.7,nowMs:1000});
  assert.equal(players.players[0].headMeshes.length,3);
  for(const player of players.players)player.human.modelRoot.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name));
  players.dispose();
});


test('numbered racks put the eight/nine in the middle and opposite groups at the back corners', () => {
  for(const [count,layout,centre] of [[15,'triangle',8],[9,'diamond',9]]) {
    const slots=generateRackPositions(count,layout,1,0);
    const numbers=Array.from({length:count},(_,i)=>i+1);
    const ordered=arrangePoolRack(slots,numbers,layout);
    assert.deepEqual(ordered[centre-1],slots[4]);
    assert.deepEqual(ordered[0],slots[0]);
    assert.equal(new Set(ordered.map(p=>`${p.x}/${p.z}`)).size,count);
    if(count===15){
      const at=slot=>ordered.findIndex(p=>p.x===slot.x && p.z===slot.z)+1;
      assert.notEqual(at(slots[10])<8,at(slots[14])<8);
    }
  }
});
