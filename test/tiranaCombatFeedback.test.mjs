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
await build({stdin:{contents:"export {CombatEffects} from './src/games/tiranastreets/CombatEffects';export {SurfaceImpactMarks} from './src/games/tiranastreets/SurfaceImpactMarks';",resolveDir:webapp,loader:'ts'},outfile:join(dir,'feedback.mjs'),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {CombatEffects,SurfaceImpactMarks}=await import(pathToFileURL(join(dir,'feedback.mjs')));

test('rapid fire reuses its fixed particle slots; battery and distant particles all expire',()=>{
  const fx=new CombatEffects(new T.Scene()),camera=new T.PerspectiveCamera();
  const original=fx.pools.map(pool=>new Set(pool.free));
  for(let i=0;i<700;i++){
    fx.shot({x:1000,y:1.5,z:0},{x:1010,y:1.5,z:0});
    fx.blood({x:1000,y:1,z:0},{x:1,y:0,z:0});
  }
  fx.update(1/60,camera,[],[],true);
  for(const [i,pool] of fx.pools.entries()){
    assert.equal(pool.items.length+pool.free.length,pool.capacity);
    assert.ok([...pool.items,...pool.free].every(item=>original[i].has(item)),'bursts reuse the original vector/particle objects');
    assert.equal(pool.mesh.count,0,'distant effects do not spend the local particle budget');
  }
  fx.update(10,camera,[],[],true);
  for(const pool of fx.pools){assert.equal(pool.items.length,0);assert.equal(pool.free.length,pool.capacity);}
  fx.reset();fx.reset();
  for(const pool of fx.pools)assert.equal(new Set(pool.free).size,pool.capacity,'reset cannot duplicate leases');
  fx.dispose();
});

test('confirmed injury events make modest support-aligned traces, deduplicate and honour the blood option',()=>{
  const fx=new CombatEffects(new T.Scene()),camera=new T.PerspectiveCamera();
  const event={id:1,kind:'blood',x:0,y:10.95,z:0,toX:1,toY:0,toZ:0,floorY:10};
  fx.consume([event]);fx.consume([event]);assert.equal(fx.pools[6].items.length,5);
  fx.update(1/60,camera);fx.update(.6,camera);
  const marks=fx.group.getObjectByName('Tirana:blood-traces');assert.ok(marks.count>0);
  const matrix=new T.Matrix4();
  for(let i=0;i<marks.count;i++){marks.getMatrixAt(i,matrix);assert.ok(Math.abs(matrix.elements[13]-10.012)<.0001,'a rooftop injury marks its supporting floor');}
  fx.setBloodEnabled(false);assert.equal(marks.count,0);fx.consume([{...event,id:2}]);assert.equal(fx.pools[6].items.length,0);
  fx.setBloodEnabled(true);fx.consume([{...event,id:3}]);assert.equal(fx.pools[6].items.length,5);
  fx.update(1/60,camera);fx.update(.6,camera);assert.ok(marks.count>0);
  fx.update(46,camera);assert.equal(marks.count,0,'persistent traces still expire');fx.dispose();
});

test('dense blood traces merge nearby hits and remain bounded through a long firefight',()=>{
  const fx=new CombatEffects(new T.Scene()),camera=new T.PerspectiveCamera(),marks=fx.bloodMarks;
  for(let i=0;i<1000;i++)marks.add(0,0,0,.12);
  marks.update(0,camera);assert.equal(marks.mesh.count,1,'repeated injury does not stack coplanar decals');
  for(let i=0;i<400;i++)marks.add(i*.4,0,2,.12);
  marks.update(1,camera);assert.ok(marks.mesh.count<=64);
  assert.equal(marks.traces.length,64);camera.position.set(-1000,0,0);marks.update(45,camera);camera.position.set(0,0,0);marks.update(0,camera);assert.equal(marks.mesh.count,0);fx.dispose();
});

test('injury feedback is per actor, rate limited and resets naturally after a clock rewind',()=>{
  const player={id:'local',x:1,z:2},npc={id:'civilian',x:3,y:8,z:4};
  const sim={player,body:{y:20},state:{elapsed:0,effects:[],effectSeq:0}},combat=new CombatSimulation(sim);
  combat.actorHit(npc,player);sim.state.elapsed=.05;combat.actorHit(npc,player);combat.actorHit(player,npc);
  assert.equal(sim.state.effects.length,2);assert.equal(sim.state.effects[0].floorY,8);assert.equal(sim.state.effects[1].floorY,20);
  assert.deepEqual([sim.state.effects[0].toX,sim.state.effects[0].toZ],[2,2]);
  sim.state.elapsed=.14;combat.actorHit(npc,player);assert.equal(sim.state.effects.length,3);
  sim.state.elapsed=0;combat.actorHit(npc,player);assert.equal(sim.state.effects.length,4);
});

test('bullet chips fade and distance cull without freezing their lifetime',()=>{
  const marks=new SurfaceImpactMarks(4),event={id:1,at:0,kind:'hit',hitKind:'wall',x:0,y:1,z:0,nx:0,ny:0,nz:1};
  marks.update([event],0,()=>undefined,undefined,{x:0,z:0});assert.equal(marks.mesh.count,1);
  marks.update([],82.5,()=>undefined,undefined,{x:0,z:0});assert.ok(Math.abs(marks.mesh.geometry.getAttribute('markAlpha').getX(0)-.5)<1e-6);
  marks.update([],83,()=>undefined,undefined,{x:100,z:0});assert.equal(marks.mesh.count,0);
  marks.update([],91,()=>undefined,undefined,{x:100,z:0});marks.update([],91,()=>undefined,undefined,{x:0,z:0});assert.equal(marks.mesh.count,0);marks.dispose();
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

test('glass fragments reuse angular pooled geometry and expire outside the battery visibility range',()=>{
  const fx=new CombatEffects(new T.Scene()),camera=new T.PerspectiveCamera(),pool=fx.pools[7];
  const slots=new Set(pool.free);
  for(let i=0;i<100;i++)fx.surfaceHit({x:1000,y:15,z:0},{x:0,y:0,z:1},'glass',12);
  assert.equal(pool.items.length,72);assert.equal(pool.mesh.geometry.getAttribute('position').count,3);
  assert.ok(pool.items.every(p=>slots.has(p)&&p.floor===12));
  assert.equal(fx.pools[2].items.length,0,'glass fragments do not emit masonry cubes');
  fx.update(1/60,camera,[],[],true);assert.equal(pool.mesh.count,0);
  fx.update(2,camera,[],[],true);assert.equal(pool.items.length,0);assert.equal(pool.free.length,72);fx.dispose();
});

test('precisely classified impact integration does not also emit generic wall debris',()=>{
  const fx=new CombatEffects(new T.Scene()),event={id:1,kind:'hit',hitKind:'wall',x:0,y:1,z:0,nx:0,ny:0,nz:1};
  fx.consume([event],()=>0,false);assert.ok(fx.pools.every(p=>p.items.length===0));
  fx.surfaceHit({x:0,y:1,z:0},{x:0,y:0,z:1},'glass',0);assert.equal(fx.pools[7].items.length,9);
  fx.consume([event],()=>0);assert.equal(fx.pools[2].items.length,0,'event consumption remains idempotent');fx.dispose();
});
