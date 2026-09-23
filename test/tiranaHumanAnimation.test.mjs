import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {canonicalHumanoidBone,humanoidBoneGroups} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';
import {npcWeaponPose} from '../webapp/src/games/tiranastreets/shared/npcWeaponPose.mjs';
import {HumanoidAnimation,locomotionClips} from '../webapp/src/games/tiranastreets/street-career/humanoidAnimation.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),dir=await mkdtemp(join(webapp,'.human-animation-test-'));
after(()=>rm(dir,{recursive:true,force:true}));
await build({stdin:{contents:"export {SharedHumans} from './src/games/tiranastreets/street-career/SharedHumans';export {LivingVisuals} from './src/games/tiranastreets/livingVisuals';",resolveDir:webapp,loader:'ts'},outfile:join(dir,'humans.mjs'),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {SharedHumans,LivingVisuals}=await import(pathToFileURL(join(dir,'humans.mjs')));
async function fixture(file,id='fixture'){
  const data=await readFile(join(webapp,'public/assets',file)),loader=new GLTFLoader();
  loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const source=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const layer=Object.create(SharedHumans.prototype);
  Object.assign(layer,{group:new T.Group(),actors:new Map(),sign:()=>new T.SpriteMaterial(),held:{forget(){}}});
  const npc={id,kind:'civilian',motion:'walk',x:0,z:0,heading:0,speed:1.4,health:100,weapon:''};
  const actor=layer.create(npc,{id,label:id,sourceId:id,url:'/assets/'+file},source);
  return {source,actor,npc,layer,bones:humanoidBoneGroups(actor.model)[0]};
}
const point=(root,bone)=>root.worldToLocal(bone.getWorldPosition(new T.Vector3()));

test('anatomy aliases preserve Quaternius spine segments and resolve hand/leg chains',()=>{
  for(const [from,to] of [['spine_01','spine'],['spine_02','spine1'],['spine_03','spine2'],['neck_01','neck'],['hand_l','lefthand'],['thigh_r','rightupleg'],['calf_r','rightleg'],['CC_Base_R_Upperarm_074','rightarm']])assert.equal(canonicalHumanoidBone(from),to);
});

test('native locomotion aliases preserve stride phase and resist walk/run threshold jitter',()=>{
  const root=new T.Group(),model=new T.Group();root.add(model);
  const clips=[['Armature|Standing Idle',2],['Walking',1],['Jogging',.6]].map(([name,duration])=>
    new T.AnimationClip(name,duration,[new T.NumberKeyframeTrack('.rotation[x]',[0,duration],[0,.05])]));
  const chosen=locomotionClips(clips);assert.equal(chosen.idle,clips[0]);assert.equal(chosen.walk,clips[1]);assert.equal(chosen.run,clips[2]);
  const animation=new HumanoidAnimation(root,model,clips),n={motion:'walk',anim:'walk'};
  for(let i=0;i<23;i++)animation.update(n,i/60,1/60,1.4);
  const phase=animation.action.time/clips[1].duration;
  animation.update(n,1,0,3.4);assert.equal(animation.action.getClip(),clips[2]);
  assert.ok(Math.abs(animation.action.time/clips[2].duration-phase)<1e-9,'run starts on the matching stride phase');
  for(const speed of [3.05,2.95,3.1,2.8]){animation.update(n,1.1,.01,speed);assert.equal(animation.action.getClip(),clips[2]);}
  animation.update(n,2,.01,2.5);assert.equal(animation.action.getClip(),clips[1]);
  animation.update(n,3,.01,0);assert.equal(animation.action.getClip(),clips[0]);
  assert.ok(model.quaternion.toArray().every(Number.isFinite));animation.dispose();
});

for(const file of ['tirana-streets/population/citizen-0.glb','tirana-streets/population/citizen-7.glb','table-tennis/chess-human.glb','table-tennis/athlete-male.glb','table-tennis/athlete-female.glb','tirana-streets/living/human.glb'])test(`${file}: actual rig walks upright and transitions between run, aim, reload and idle`,async()=>{
  const {actor,npc,bones,layer,source}=await fixture(file),{root,animation}=actor;
  const sourceTracks=source.animations.map(c=>c.tracks.map(t=>Array.from(t.values)));
  const restHip=point(root,bones.get('hips')),restHead=point(root,bones.get('head'));
  assert.ok(point(root,bones.get('leftarm')).x>point(root,bones.get('rightarm')).x,'the original body faces its walking direction');
  const feet=[];
  for(let frame=0;frame<180;frame++){
    const t=frame/60;npc.anim=frame<90?'walk':'run';
    animation.update(npc,t,1/60,frame<90?1.4:4.5);root.updateMatrixWorld(true);
    const hip=point(root,bones.get('hips')),head=point(root,bones.get('head')),foot=point(root,bones.get('leftfoot'));
    assert.ok(Math.abs(hip.x-restHip.x)<.05&&Math.abs(hip.z-restHip.z)<.05,'animation never drives the simulation root');
    assert.ok(head.y-hip.y>.43&&Math.abs(head.x-hip.x)<.12&&Math.abs(head.z-hip.z)<.3,'torso stays upright');
    assert.ok(foot.y>-.08&&foot.y<(npc.anim==='run'?.9:.5),`foot stays within a walking/running stride: ${foot.y}`);
    if(frame>110&&!source.animations.length)for(const side of ['left','right']){
      const hand=point(root,bones.get(side+'hand')),shoulder=point(root,bones.get(side+'arm'));
      assert.ok(Math.abs(hand.x-shoulder.x)<.13,'retargeted running forearms swing alongside the torso');
    }
    feet.push(foot.z);
  }
  assert.ok(Math.max(...feet)-Math.min(...feet)>.15,'feet actually stride');
  for(const anim of ['aim','reload','hit','idle']){
    npc.anim=anim;npc.weapon=anim==='aim'||anim==='reload'?'ak47VolleyAttack':'';
    for(let frame=0;frame<90;frame++)animation.update(npc,4+frame/60,1/60,anim==='idle'?0:1.4);
    root.updateMatrixWorld(true);
    for(const bone of bones.values())assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    if(anim==='aim'){
      const grips=npcWeaponPose(npc);
      for(const side of ['left','right']){
        const g=grips[side],hand=point(root,bones.get(side+'hand'));
        assert.ok(hand.distanceTo(new T.Vector3(g.x,g.y,g.z))<.11,`${side} hand aligns to the actual weapon grip`);
      }
    }
  }
  assert.ok(Math.abs(point(root,bones.get('head')).y-restHead.y)<.15,'idle restores the authored torso');
  assert.deepEqual(source.animations.map(c=>c.tracks.map(t=>Array.from(t.values))),sourceTracks,'source animation data stays immutable');
  layer.remove(npc.id);
});

test('same-state recoil does not accumulate and clones never share animated bones',async()=>{
  const {source,actor,npc,layer,bones}=await fixture('tirana-streets/population/citizen-0.glb');
  const other=layer.create({...npc,id:'second'},{id:'second',label:'second',url:'fixture'},source);
  const otherBones=humanoidBoneGroups(other.model)[0],rest=otherBones.get('rightarm').quaternion.clone();
  npc.anim='aim';npc.weapon='ak47VolleyAttack';npc.firedAt=2;
  actor.animation.update(npc,2.02,0,0);
  const first=point(actor.root,bones.get('righthand'));
  for(let i=0;i<300;i++)actor.animation.update(npc,2.02,0,0);
  assert.ok(point(actor.root,bones.get('righthand')).distanceTo(first)<1e-6,'recoil always layers on a fresh base pose');
  assert.notEqual(bones.get('rightarm'),otherBones.get('rightarm'));
  assert.ok(otherBones.get('rightarm').quaternion.angleTo(rest)<1e-6,'another citizen stays unchanged');
  layer.remove(npc.id);layer.remove('second');
});

test('rendered NPC displacement stops foot cycling at obstacles and resumed frames stay bounded',async()=>{
  const {actor,npc,layer,source}=await fixture('tirana-streets/population/citizen-0.glb');
  const asset={id:'fixture',label:'fixture',url:'/fixture.glb',roles:['civilian']};
  Object.assign(layer,{cast:[asset],sources:new Map([[asset.url,source]]),failed:new Set(),request(){},bounds:new T.Sphere(new T.Vector3(),2.4),held:{pose(){},forget(){}}});
  const viewer={x:0,z:0};
  for(let frame=0;frame<40;frame++){npc.x+=1.4/60;layer.update([npc],viewer,frame/60,1/60);}
  assert.ok(actor.gaitSpeed>1.2,'moving visual drives a walking cadence');
  // Navigation can still request walking while collision has stopped movement.
  npc.speed=1.4;
  for(let frame=0;frame<70;frame++)layer.update([npc],viewer,1+frame/60,1/60);
  assert.ok(actor.gaitSpeed<.02,'stationary actor stops stepping despite desired navigation speed');
  const gait=actor.animation.gait;npc.x+=8;
  layer.update([npc],viewer,10,3);
  assert.ok(actor.animation.gait-gait<.2,'long resume/teleport does not animate a catch-up sprint');
  assert.ok(Math.abs(actor.root.position.x-npc.x)<1e-8,'placement still reaches the new simulation state');
  layer.remove(npc.id);
});

test('the actual held-weapon pass cannot overwrite corrected Mixamo aiming with legacy Euler angles',async()=>{
  const {actor,npc,layer,bones}=await fixture('tirana-streets/living/human.glb');
  npc.anim='aim';npc.weapon='ak47VolleyAttack';
  for(let i=0;i<30;i++)actor.animation.update(npc,i/60,1/60,0);
  const before=bones.get('rightarm').quaternion.clone();
  const held=Object.create(LivingVisuals.prototype);
  Object.assign(held,{disposed:false,holders:new Map(),models:new Map(),load:async()=>{}});
  held.pose('actual-held-pass',actor.root,npc,1);
  assert.ok(bones.get('rightarm').quaternion.angleTo(before)<1e-6,'held gun renderer preserves the rig-safe arm solution');
  assert.equal(actor.root.userData.rigPoseOwner,'shared-human');
  layer.remove(npc.id);
});
