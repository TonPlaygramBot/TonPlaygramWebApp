import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {CombatSimulation} from '../webapp/src/games/tiranastreets/street-career/CombatSimulation.mjs';
import {HumanoidAnimation} from '../webapp/src/games/tiranastreets/street-career/humanoidAnimation.mjs';
import {solveHumanoidLimb} from '../webapp/src/games/tiranastreets/street-career/humanoidRig.mjs';

const webapp=fileURLToPath(new URL('../webapp/',import.meta.url)),dir=await mkdtemp(join(webapp,'.combat-feedback-test-'));
after(()=>rm(dir,{recursive:true,force:true}));

test('injury feedback is per actor, rate limited and resets naturally after a clock rewind',()=>{
  const player={id:'local',x:1,z:2},npc={id:'civilian',x:3,y:8,z:4};
  const sim={player,body:{y:20},state:{elapsed:0,effects:[],effectSeq:0}},combat=new CombatSimulation(sim);
  combat.actorHit(npc,player);sim.state.elapsed=.05;combat.actorHit(npc,player);combat.actorHit(player,npc);
  assert.equal(sim.state.effects.length,2);assert.equal(sim.state.effects[0].floorY,8);assert.equal(sim.state.effects[1].floorY,20);
  assert.deepEqual([sim.state.effects[0].toX,sim.state.effects[0].toZ],[2,2]);
  sim.state.elapsed=.14;combat.actorHit(npc,player);assert.equal(sim.state.effects.length,3);
  sim.state.elapsed=0;combat.actorHit(npc,player);assert.equal(sim.state.effects.length,4);
});

test('native clips and procedural stride conserve elapsed time at reduced pose frequencies',()=>{
  const create=()=>{
    const root=new T.Group(),model=new T.Group();root.add(model);
    const clip=new T.AnimationClip('walk',2,[new T.NumberKeyframeTrack('.rotation[x]',[0,2],[0,.05])]);
    return new HumanoidAnimation(root,model,[clip]);
  };
  const smooth=create(),lod=create(),npc={motion:'walk',anim:'walk'};
  for(let i=0;i<60;i++)smooth.update(npc,(i+1)/60,1/60,1.4);
  for(let i=0;i<8;i++)lod.update(npc,(i+1)/8,1/8,1.4);
  assert.ok(Math.abs(smooth.gait-lod.gait)<1e-10);assert.ok(Math.abs(smooth.action.time-lod.action.time)<1e-10);
  smooth.dispose();lod.dispose();
});

test('reused IK workspaces preserve targets and isolate differently transformed humanoid rigs',()=>{
  const create=(offset=0)=>{
    const root=new T.Group(),bones=new Map();root.position.set(offset,offset*.5,-offset);root.rotation.y=offset*.17;root.scale.setScalar(1+offset*.02);
    for(const side of ['left','right']){
      const upper=new T.Bone(),lower=new T.Bone(),end=new T.Bone();root.add(upper);upper.add(lower);lower.add(end);
      upper.position.set(side==='left'?.2:-.2,1.4,0);lower.position.y=-.35;end.position.y=-.3;
      bones.set(side+'arm',upper);bones.set(side+'forearm',lower);bones.set(side+'hand',end);
    }
    root.updateMatrixWorld(true);return {root,bones};
  };
  const isolated=create(),interleaved=create(),other=create(7),target=new T.Vector3();
  for(let i=0;i<80;i++){
    const side=i%2?'left':'right';target.set(side==='left'?.28:-.28,1.08+Math.sin(i*.2)*.1,.3);
    const preserved=target.clone();solveHumanoidLimb(isolated.root,isolated.bones,side,target);
    solveHumanoidLimb(other.root,other.bones,side,other.root.localToWorld(target.clone()));
    solveHumanoidLimb(interleaved.root,interleaved.bones,side,target);
    assert.deepEqual(target.toArray(),preserved.toArray(),'the caller retains its target vector');
    for(const [name,bone]of isolated.bones){
      const actual=interleaved.bones.get(name);assert.ok(bone.quaternion.angleTo(actual.quaternion)<1e-7);
      assert.ok(bone.getWorldPosition(new T.Vector3()).distanceTo(actual.getWorldPosition(new T.Vector3()))<1e-10);
    }
  }
});
