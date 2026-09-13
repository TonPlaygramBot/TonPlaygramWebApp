import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {arenaHarness,loadArenaCharacter} from './fixtures/murlanArenaHarness.mjs';
import {supportFixedCards,cardContactPoint,poseCardHand,applyCardPickupGesture,CARD_PICKUP_REACH_MS,
  CARD_CARRY_MS,CARD_ACTION_MS} from '../webapp/src/games/murlan/cardContact.ts';
import {beginCardPlay,stepCardPlay} from '../webapp/src/games/murlan/cardMotion.ts';
const morning=JSON.parse(fs.readFileSync(new URL('./fixtures/murlanMorningPlayerCards.json',import.meta.url)));
const makeSeat=()=>({...morning.seat,forward:new THREE.Vector3(0,0,1),right:new THREE.Vector3(-1,0,0)});

test('the production player-card layout matches all 76 pre-change morning transforms with a human rig enabled',async()=>{
  const {rig,scene}=await loadArenaCharacter();
  for(const count of [1,5,14,18]) {
    const hand=Array.from({length:count},(_,i)=>({id:`card-${i}`}));
    const meshes=hand.map(()=>new THREE.Object3D());meshes.forEach(m=>scene.add(m));
    const state={status:'PLAYING',players:[{isHuman:true,hand}],activePlayer:0,tableCards:[],discardPile:[],stockCards:[]};
    const store={scene,seatConfigs:[{...makeSeat(),characterRig:rig}],cardMap:new Map(hand.map((card,i)=>[card.id,{mesh:meshes[i]}])),animations:[]};
    const {invoke}=arenaHarness({threeStateRef:{current:store},prevStateRef:{current:state},humanTurnRef:{current:false},
      applyHandCardLayering(){},setBackLogoOrientation(){},updateCardFace(){},setCommunityCardLegibility(){}});
    for(const expected of morning.cases.filter(c=>c.count===count)) {
      invoke('applyTestHandState',state,expected.selected?[hand[expected.index].id]:[],true);
      const mesh=meshes[expected.index];
      assert.ok(mesh.position.distanceTo(new THREE.Vector3(...expected.position))<1e-10);
      assert.ok(mesh.quaternion.angleTo(new THREE.Quaternion(...expected.quaternion))<1e-7);
      assert.equal(mesh.scale.x,expected.scale);
      assert.equal(store.selectionTargets.length,count);
    }
    meshes.forEach(m=>scene.remove(m));
  }
});

test('the supporting hand and pickup adapt to the fixed full-size fan without moving unplayed cards',async()=>{
  const {rig,scene,constants:c}=await loadArenaCharacter();
  const {invoke}=arenaHarness();
  const cards=Array.from({length:18},(_,i)=>{
    const layout=invoke('getHandCardLayout',makeSeat(),18,i,true);
    const m=new THREE.Object3D();m.position.copy(layout.position);m.scale.setScalar(layout.scale);
    invoke('orientMesh',m,layout.lookTarget,layout.orientation);scene.add(m);return m;
  });
  const originals=cards.map(m=>[...m.position.toArray(),...m.quaternion.toArray(),...m.scale.toArray()]);
  const lengths=Object.values(rig.cardContact.arms).map(a=>[a.elbow.position.length(),a.hand.position.length()]);
  supportFixedCards(rig.cardContact,cards,c.CARD_H,0,false,true);
  const left=rig.cardContact.arms.left;
  const support=cards[Math.floor((cards.length-1)*.65)];
  assert.ok(cardContactPoint(support,c.CARD_H,new THREE.Vector3(),'left').distanceTo(left.hand.localToWorld(left.pinch.anchor.clone()))<1e-6);
  for(const m of cards) assert.ok(poseCardHand(rig.cardContact,'right',m,c.CARD_H)<1e-6);
  for(const index of [0,8,17]) {
    const m=cards[index];
    m.userData.animation={precisionContact:true,from:m.position.clone(),fromQuaternion:m.quaternion.clone(),to:new THREE.Vector3(0,c.TABLE_HEIGHT+.08,.54),toQuaternion:new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),start:CARD_PICKUP_REACH_MS,duration:CARD_CARRY_MS};
    const play=beginCardPlay(rig.cardContact,[m],c.CARD_H);
    stepCardPlay(rig.cardContact,play,c.CARD_H,CARD_PICKUP_REACH_MS-.01);
    const position=m.position.clone();
    stepCardPlay(rig.cardContact,play,c.CARD_H,CARD_PICKUP_REACH_MS+.01);
    assert.ok(m.position.distanceTo(position)<1e-5,'no pickup teleport');
    stepCardPlay(rig.cardContact,play,c.CARD_H,CARD_ACTION_MS+1);
    m.position.copy(play.transfers[0].from);m.quaternion.copy(play.transfers[0].fromQuaternion);
  }
  assert.deepEqual(cards.map(m=>[...m.position.toArray(),...m.quaternion.toArray(),...m.scale.toArray()]),originals);
  assert.deepEqual(Object.values(rig.cardContact.arms).map(a=>[a.elbow.position.length(),a.hand.position.length()]),lengths);
});

test('the index finds the edge before the thumb closes, and the final grip matches calibrated contacts',async()=>{
  const {rig}=await loadArenaCharacter();
  const fingers=rig.cardContact.arms.right.pinch.fingers;
  applyCardPickupGesture(rig.cardContact,.72);
  const [thumb,index]=fingers;
  assert.ok(Math.abs(thumb.finger.joints[0].flex-.1)<1e-8,'thumb remains open at index contact');
  assert.ok(Math.abs(index.finger.joints[0].flex-.1)>1e-3,'index has started closing');
  applyCardPickupGesture(rig.cardContact,1);
  for(const {finger,pose} of fingers) finger.joints.forEach((joint,i)=>assert.ok(Math.abs(joint.flex-pose[i].flex)<1e-7));
});
