import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {loadArenaCharacter,arenaHarness} from './fixtures/murlanArenaHarness.mjs';
import {heldCardPose,poseCardHand,pinCardToHand,cardContactPoint,sampleCardTransfer,cardScaleForHand,CARD_PICKUP_REACH_MS,CARD_CARRY_MS,CARD_RELEASE_MS,CARD_RECOVER_MS,CARD_ACTION_MS,captureCardHandPose,restoreCardHand} from '../webapp/src/games/murlan/cardContact.ts';
import {beginCardPlay,stepCardPlay} from '../webapp/src/games/murlan/cardMotion.ts';

test('the original avatar resolves both complete hand rigs and all fan cards meet the palm',async()=>{
  for(let seat=0;seat<4;seat++) {
    const {rig,scene,constants:c}=await loadArenaCharacter(seat);
    assert.deepEqual(Object.keys(rig.cardContact.arms).sort(),['left','right']);
    const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-seat*Math.PI/2,0));
    for(const count of [1,2,5,14,18]) for(let i=0;i<count;i++) {
      const pose=heldCardPose(rig.cardContact,orientation,i,count,c.CARD_H,1);
      const card=new THREE.Object3D();card.position.copy(pose.position);card.quaternion.copy(pose.quaternion);scene.add(card);
      const arm=rig.cardContact.arms.left;
      const palm=arm.hand.localToWorld(arm.pinch.anchor.clone());
      assert.ok(cardContactPoint(card,c.CARD_H,new THREE.Vector3(),'left').distanceTo(palm)<=0.0008*i+1e-8);
      scene.remove(card);
    }
  }
});

test('pickup, release and recovery remain continuous at the ends of an 18-card fan in every seat',async()=>{
  for (let seat=0;seat<4;seat++) for (const index of [0,17]) {
    const {rig,scene,constants:c}=await loadArenaCharacter(seat);
    const orientation=rig.instance.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
    const scale=cardScaleForHand(rig.cardContact,c.CARD_H);
    const pose=heldCardPose(rig.cardContact,orientation,index,18,c.CARD_H,scale);
    const mesh=new THREE.Object3D();scene.add(mesh);mesh.scale.setScalar(scale);mesh.position.copy(pose.position);mesh.quaternion.copy(pose.quaternion);
    restoreCardHand(rig.cardContact,'right');
    const idle=captureCardHandPose(rig.cardContact,'right');
    mesh.userData.animation={precisionContact:true,from:mesh.position.clone(),fromQuaternion:mesh.quaternion.clone(),
      to:new THREE.Vector3(0,c.TABLE_HEIGHT+.08,.54),toQuaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),start:CARD_PICKUP_REACH_MS};
    const play=beginCardPlay(rig.cardContact,[mesh],c.CARD_H);
    const boundaryTimes=[0,CARD_PICKUP_REACH_MS,CARD_PICKUP_REACH_MS+CARD_CARRY_MS,CARD_ACTION_MS-CARD_RECOVER_MS,CARD_ACTION_MS];
    for (const boundary of boundaryTimes) {
      stepCardPlay(rig.cardContact,play,c.CARD_H,Math.max(0,boundary-.01));
      const cardBefore=mesh.position.clone(),wristBefore=rig.bones.rightHand.getWorldPosition(new THREE.Vector3());
      const poseBefore=captureCardHandPose(rig.cardContact,'right');
      stepCardPlay(rig.cardContact,play,c.CARD_H,boundary+.01);
      assert.ok(mesh.position.distanceTo(cardBefore)<1e-5,`card jumps at ${boundary}ms, seat ${seat}, index ${index}`);
      assert.ok(rig.bones.rightHand.getWorldPosition(new THREE.Vector3()).distanceTo(wristBefore)<1e-5);
      captureCardHandPose(rig.cardContact,'right').forEach((q,i)=>assert.ok(q.angleTo(poseBefore[i])<.001));
    }
    captureCardHandPose(rig.cardContact,'right').forEach((q,i)=>assert.ok(q.angleTo(idle[i])<.001));
  }
});

test('real cards stay at the fingertips throughout carry without stretching bones at 30/60/120 fps',async()=>{
  for(let seat=0;seat<4;seat++) {
    const {rig,scene,constants:c,seatConfig}=await loadArenaCharacter(seat);
    const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,-seat*Math.PI/2,0));
    const held=heldCardPose(rig.cardContact,orientation,3,7,c.CARD_H,1);
    const arm=rig.cardContact.arms.right;
    const lengths=[arm.elbow.position.length(),arm.hand.position.length()];
    const target=new THREE.Vector3(0,c.TABLE_HEIGHT+0.08,0.54);
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
    const card=new THREE.Object3D(); scene.add(card);
    for(const fps of [30,60,120]) for(let i=0;i<=fps;i++) {
      const pose=sampleCardTransfer(i/fps,held.position,target,held.quaternion,rotation,0.05);
      card.position.copy(pose.position);card.quaternion.copy(pose.quaternion);
      poseCardHand(rig.cardContact,'right',card,c.CARD_H);
      pinCardToHand(rig.cardContact,'right',card,c.CARD_H);
      const actual=arm.hand.localToWorld(arm.pinch.anchor.clone());
      assert.ok(cardContactPoint(card,c.CARD_H).distanceTo(actual)<1e-8);
      assert.deepEqual([arm.elbow.position.length(),arm.hand.position.length()],lengths);
      for(const n of [...card.position.toArray(),...arm.upper.quaternion.toArray(),...arm.elbow.quaternion.toArray()])assert.ok(Number.isFinite(n));
    }
  }
});

test('transfer preserves exact start/end transforms and stays above the interpolated surface',()=>{
  const from=new THREE.Vector3(1,1.5,2),to=new THREE.Vector3(-.2,.8,.5);
  const a=new THREE.Quaternion(),b=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
  for(const t of [0,.01,.25,.5,.75,.99,1]) {
    const pose=sampleCardTransfer(t,from,to,a,b,.08);
    assert.ok(pose.position.y>=Math.min(from.y,to.y)-1e-9);
    assert.ok(Math.abs(pose.quaternion.length()-1)<1e-9);
    if(t===0)assert.ok(pose.position.distanceTo(from)<1e-9 && pose.quaternion.angleTo(a)<1e-8);
    if(t===1)assert.ok(pose.position.distanceTo(to)<1e-9 && pose.quaternion.angleTo(b)<1e-8);
  }
});

test('scene rerenders retain an in-flight transfer and do not flip cards before pickup',()=>{
  const {context:c,load}=arenaHarness();for(const n of ['setMeshPosition','orientMesh','CARD_ANIMATION_DURATION'])load(n);
  const card=new THREE.Object3D(),to=new THREE.Vector3(0,1,1),look=new THREE.Vector3(0,1,4),animations=[];
  card.quaternion.setFromEuler(new THREE.Euler(.4,.3,.2));const start=card.quaternion.clone();
  c.setMeshPosition(card,to,look,{flat:true,face:'front'},false,animations,320,{precisionContact:true,duration:1200});
  assert.deepEqual(card.quaternion.toArray(),start.toArray());
  const first=card.userData.animation;
  c.setMeshPosition(card,to,look,{flat:true,face:'front'},false,animations);
  assert.equal(card.userData.animation,first);assert.equal(animations.length,1);
  assert.equal(first.precisionContact,true);
});

test('production action carries the same meshes for singles and combinations and ends at exact table slots',async()=>{
 for (const count of [1,2,4,5]) {
  const {rig,scene,constants:c}=await loadArenaCharacter();
  const orientation=new THREE.Quaternion();
  const targetQuaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
  const start=performance.now();
  const cards=Array.from({length:count},(_,index)=>{
    const held=heldCardPose(rig.cardContact,orientation,index,count,c.CARD_H,1);
    const mesh=new THREE.Object3D();mesh.position.copy(held.position);mesh.quaternion.copy(held.quaternion);scene.add(mesh);
    const target=new THREE.Vector3(index*.2,c.TABLE_HEIGHT+.08,.54);
    mesh.userData.animation={precisionContact:true,start:start+CARD_PICKUP_REACH_MS,duration:CARD_CARRY_MS,from:mesh.position.clone(),fromQuaternion:mesh.quaternion.clone(),to:target,toQuaternion:targetQuaternion};
    return {mesh,target,id:`played-${index}`};
  });
  const store={scene,cardMap:new Map(cards.map(card=>[card.id,card])),characterRigs:new Map([[0,rig]]),characterActionAnimations:[]};
  const {context:api,load}=arenaHarness();
  for(const name of ['runCharacterAction','updateCharacterCardContacts','CARD_H','MODEL_SCALE'])load(name);
  api.runCharacterAction(store,rig,{type:'PLAY',playerIndex:0,cards});
  const children=scene.children.length;
  for(let ms=0;ms<=CARD_ACTION_MS+10;ms+=10){
    if(ms>=CARD_PICKUP_REACH_MS&&ms<=CARD_PICKUP_REACH_MS+CARD_CARRY_MS) for (const {mesh,target} of cards) {
      const animation=mesh.userData.animation;
      const pose=sampleCardTransfer((ms-CARD_PICKUP_REACH_MS)/CARD_CARRY_MS,animation.from,target,animation.fromQuaternion,targetQuaternion,.05);
      mesh.position.copy(pose.position);mesh.quaternion.copy(pose.quaternion);
    }
    api.updateCharacterCardContacts(store,start+ms);
    assert.equal(scene.children.length,children,'no placeholder mesh');
    if(ms>=CARD_PICKUP_REACH_MS+CARD_CARRY_MS*.26&&ms<CARD_PICKUP_REACH_MS+CARD_CARRY_MS) cards.forEach(({mesh},index)=>{
      const hand=rig.cardContact.arms.right;
      assert.ok(cardContactPoint(mesh,c.CARD_H).distanceTo(hand.hand.localToWorld(hand.pinch.anchor.clone()))<=index*.0008+1e-8);
    });
  }
  assert.ok(rig.cardPlay === null, 'action returns to idle after recovery');
  for (const {mesh,target} of cards) {
    assert.ok(mesh.position.distanceTo(target)<1e-8);
    assert.ok(mesh.quaternion.angleTo(targetQuaternion)<1e-7);
  }
 }
});
