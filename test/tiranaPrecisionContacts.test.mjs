import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {humanoidBones,normalizePlayableHuman} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
import {humanoidPalmPoint,solveHumanoidGrip} from '../webapp/src/games/tiranastreets/street-career/humanoidHands.mjs';
import {steeringWheelContacts,steeringWheelRadius,steeringWheelAngle} from '../webapp/src/games/tiranastreets/street-career/vehicleCore.mjs';
import {driverPoint,driverWheel,driverUp} from '../webapp/src/games/tiranastreets/shared/driverView.mjs';
import {weaponAnchors} from '../webapp/src/games/tiranastreets/street-career/weaponPose.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),temp=await mkdtemp(join(webapp,'.precision-contact-test-'));
after(()=>rm(temp,{recursive:true,force:true}));
await build({stdin:{contents:"export {FirstPersonBody} from './src/games/tiranastreets/street-career/FirstPersonBody';export {DriverInterior} from './src/games/tiranastreets/DriverInterior';",resolveDir:webapp,loader:'ts'},outfile:join(temp,'body.mjs'),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {FirstPersonBody,DriverInterior}=await import(pathToFileURL(join(temp,'body.mjs')));

const vec=p=>new T.Vector3(p.x,p.y,p.z);
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const bytes=await readFile(new URL('../webapp/public/assets/tirana-streets/players/turi.glb',import.meta.url));
const loader=new GLTFLoader();
loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
const source=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');

function turi() {
  const root=normalizePlayableHuman(clone(source.scene)),bones=humanoidBones(root);
  const rests=new Map([...bones.values()].map(bone=>[bone,{q:bone.quaternion.clone(),p:bone.position.clone(),s:bone.scale.clone()}]));
  return {root,bones,reset(){for(const [bone,rest] of rests){bone.quaternion.copy(rest.q);bone.position.copy(rest.p);bone.scale.copy(rest.s);}root.updateMatrixWorld(true);}};
}

test('actual Turi palms reach held contacts through translated and rotated actor frames',()=>{
  const originalTracks=source.animations.map(clip=>clip.tracks.map(track=>Array.from(track.values)));
  const {root,bones,reset}=turi();
  for(const yaw of [0,.7,Math.PI,-1.2])for(const pitch of [-.3,0,.35]) {
    root.position.set(12,2,-8);root.rotation.set(.08,yaw,-.04,'YXZ');reset();
    const facing=root.getWorldQuaternion(new T.Quaternion());
    for(const side of ['left','right']) {
      const contact=root.localToWorld(new T.Vector3(side==='left'?.1:-.1,1.4,.3));
      const along=new T.Vector3(0,1,.2).normalize().applyAxisAngle(new T.Vector3(1,0,0),pitch).applyQuaternion(facing);
      const normal=new T.Vector3(side==='left'?-1:1,0,0).applyQuaternion(facing);
      const contactBefore=contact.clone(),alongBefore=along.clone(),normalBefore=normal.clone();
      solveHumanoidGrip(root,bones,side,contact,along,normal,1);
      const palm=humanoidPalmPoint(bones,side);
      assert.ok(palm.distanceTo(contact)<.004,`${side} palm misses the grip by ${palm.distanceTo(contact)} m`);
      assert.ok(bones.get(side+'hand').getWorldPosition(new T.Vector3()).distanceTo(contact)>.02,'the palm, rather than the wrist joint, contacts the handle');
      assert.ok(contact.equals(contactBefore)&&along.equals(alongBefore)&&normal.equals(normalBefore),'caller-owned contacts and axes remain unchanged');
      for(const bone of bones.values())assert.ok(bone.quaternion.toArray().every(Number.isFinite),`${bone.name} has a finite rotation`);
    }
  }
  assert.deepEqual(source.animations.map(clip=>clip.tracks.map(track=>Array.from(track.values))),originalTracks,'original locomotion tracks remain unchanged');
});

test('Turi contact layers reset without finger or wrist drift and keep bone lengths intact',()=>{
  const {root,bones,reset}=turi(),target=new T.Vector3(-.1,1.4,.3),along=new T.Vector3(0,1,.2).normalize(),normal=new T.Vector3(1,0,0);
  const lengths=new Map([...bones].map(([name,bone])=>[name,bone.position.length()]));
  reset();solveHumanoidGrip(root,bones,'right',target,along,normal,1);
  const first=new Map([...bones].map(([name,bone])=>[name,bone.quaternion.clone()]));
  for(let frame=0;frame<120;frame++){
    reset();solveHumanoidGrip(root,bones,'right',target,along,normal,1);
    assert.ok(humanoidPalmPoint(bones,'right').distanceTo(target)<.004);
  }
  for(const [name,bone] of bones){
    assert.ok(bone.quaternion.clone().normalize().angleTo(first.get(name).clone().normalize())<1e-5,`${name} accumulates no contact rotation`);
    near(bone.position.length(),lengths.get(name));
  }
  reset();solveHumanoidGrip(root,bones,'right',new T.Vector3(5,3,5),along,normal,1);
  for(const [name,bone] of bones){assert.ok(bone.quaternion.toArray().every(Number.isFinite));near(bone.position.length(),lengths.get(name));}
});

test('steering contacts stay on the visible wheel rim and move in opposite directions',()=>{
  const sample=()=>0;
  for(const model of ['sedan','tirana-bus'])for(const heading of [0,.9,Math.PI])for(const steering of [-1,-.4,0,.4,1]){
    const car={model,x:12,z:18,heading,steering},contacts=steeringWheelContacts(car,sample);
    const hub=vec(driverPoint(car,driverWheel(car),sample)),radius=model==='tirana-bus'?.24:.215;
    near(steeringWheelRadius(car),radius);
    const left=vec(contacts.left),right=vec(contacts.right);
    near(left.distanceTo(hub),radius);near(right.distanceTo(hub),radius);
    assert.ok(left.clone().add(right).multiplyScalar(.5).distanceTo(hub)<1e-6,'hands remain opposite around the rendered steering hub');
    if(steering===0){near(left.y,hub.y);near(right.y,hub.y);}
  }
  const car={model:'sedan',x:0,z:0,heading:0,steering:1},turned=steeringWheelContacts(car,sample),straight=steeringWheelContacts({...car,steering:0},sample);
  assert.ok(turned.left.y>straight.left.y&&turned.right.y<straight.right.y,'clockwise wheel turn raises its left contact and lowers its right contact');
  assert.ok(Math.abs(turned.left.z-straight.left.z)>.01,'the tilted wheel axis also changes contact depth');
  near(steeringWheelAngle({...car,steering:10}),steeringWheelAngle(car));
  near(steeringWheelAngle({...car,steering:-10}),-steeringWheelAngle(car));
});

test('steering contacts follow the same support plane as the dashboard on slopes',()=>{
  const slope=(x,z)=>100+x*.2+z*.15,flat=()=>0;
  for(const heading of [0,.7,-1.4])for(const steering of [-1,0,1]){
    const car={model:'sedan',x:10,z:20,heading,steering};
    const flatContacts=steeringWheelContacts({...car,x:0,z:0},flat),hillContacts=steeringWheelContacts(car,slope);
    const up=vec(driverUp(car,slope)),tilt=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up),origin=new T.Vector3(car.x,slope(car.x,car.z),car.z);
    for(const side of ['left','right']){
      const expected=vec(flatContacts[side]).applyQuaternion(tilt).add(origin);
      assert.ok(expected.distanceTo(vec(hillContacts[side]))<1e-6,`${side} hand shares the dashboard support frame`);
    }
  }
});

function playableTuri() {
  const model=clone(source.scene),root=normalizePlayableHuman(model),mixer=new T.AnimationMixer(model),scene=new T.Scene();scene.add(root);
  const clips=Object.fromEntries(source.animations.map(clip=>[clip.name,mixer.clipAction(clip.clone())]));
  const actor={group:root,mixer,clips,idle:clips.Idle,walk:clips.Walk,run:clips.Run},body=new FirstPersonBody(scene);
  body.loadWeapon=async()=>{};
  for(const id of ['ak47VolleyAttack','glockSidearmAttack'])body.models.set(id,new T.Group());
  const player={id:'contact-player',x:0,z:0,heading:0,speed:0,health:100,weapon:'ak47VolleyAttack',nextShot:0};
  const state={x:0,z:0,y:0,eye:1.62,yaw:0,pitch:0,wall:10,grounded:true,crouched:false,aim:false,recoil:0,gait:0,vx:0,vz:0,guard:false,action:null};
  return {root,bones:humanoidBones(root),actor,body,player,state};
}

test('playable Turi palms remain on weapon sockets through aim, recoil and reload',()=>{
  const {root,bones,actor,body,player,state}=playableTuri(),failures=[];
  try {
    for(const weapon of ['ak47VolleyAttack','glockSidearmAttack'])for(const yaw of [0,.7])for(const pitch of [-.3,0,.3])for(const aim of [false,true])for(const recoil of [0,.04])for(const reload of [false,true]){
      player.weapon=weapon;Object.assign(state,{yaw,pitch,aim,recoil,action:reload?{kind:'reload',start:0,duration:1}:null});
      body.update(actor,player,state,.5,0,undefined,true);root.updateMatrixWorld(true);body.weapon.updateMatrixWorld(true);
      const anchors=weaponAnchors(weapon);
      for(const side of reload?['right']:['left','right']){
        const socket=body.weapon.localToWorld(vec(side==='left'?anchors.leftSupport:anchors.rightGrip));
        const error=humanoidPalmPoint(bones,side).distanceTo(socket);

        if(error>.006)failures.push({weapon,yaw,pitch,aim,recoil,reload,side,error});
      }
      for(const bone of bones.values())assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    }
    assert.equal(failures.length,0,`weapon contact misses: ${JSON.stringify(failures)}; total ${failures.length}`);
  } finally {body.dispose();}
});

test('playable Turi hands track the steering wheel with feet inside the forward footwell',()=>{
  const {root,bones,actor,body,player,state}=playableTuri(),failures=[];
  try {
    for(const heading of [0,.7])for(const steering of [-1,0,1]) {
      const car={id:'contact-car',model:'sedan',x:0,z:0,heading,steering,speed:0};
      Object.assign(state,{yaw:heading,pitch:0,recoil:0,action:null});
      body.update(actor,player,state,1,0,car,true);root.updateMatrixWorld(true);
      const contacts=steeringWheelContacts(car),pelvis=bones.get('hips').getWorldPosition(new T.Vector3()),forward=new T.Vector3(-Math.sin(heading),0,-Math.cos(heading));
      for(const side of ['left','right']){
        const error=humanoidPalmPoint(bones,side).distanceTo(vec(contacts[side]));
        if(error>.006)failures.push({heading,steering,side,error});
        const foot=bones.get(side+'foot').getWorldPosition(new T.Vector3());
        assert.ok(foot.toArray().every(Number.isFinite));
        assert.ok(foot.y<pelvis.y-.1,`${side} foot stays below the seat`);
        assert.ok(foot.clone().sub(pelvis).dot(forward)>.1,`${side} foot sits ahead of the pelvis`);
      }
    }
    assert.equal(failures.length,0,`wheel contact misses: ${JSON.stringify(failures)}`);
  } finally {body.dispose();}
});

test('rendered cabin steering rims use the exact hand-contact transform on flat roads and slopes',()=>{
  const interior=new DriverInterior(),flat=()=>0,slope=(x,z)=>100+x*.2+z*.15;
  try {
    for(const model of ['sedan','tirana-bus'])for(const sample of [flat,slope])for(const heading of [0,.7])for(const steering of [-1,0,1]){
      const car={id:'rendered-contact-car',model,x:10,z:20,heading,steering,speed:0};
      interior.update(car,sample);interior.group.updateMatrixWorld(true);
      let ring;interior.group.traverse(object=>{if(object.geometry?.type==='TorusGeometry')ring=object;});
      assert.ok(ring,'the active cabin renders its steering rim');
      const contacts=steeringWheelContacts(car,sample),radius=ring.geometry.parameters.radius;
      for(const [side,sign] of [['left',-1],['right',1]]){
        const rendered=ring.localToWorld(new T.Vector3(sign*radius,0,0));
        assert.ok(rendered.distanceTo(vec(contacts[side]))<1e-6,`${model} ${side} heading=${heading} steering=${steering} slope=${sample===slope}: rendered=${rendered.toArray()} contact=${JSON.stringify(contacts[side])}`);
      }
    }
  } finally {interior.dispose();}
});
