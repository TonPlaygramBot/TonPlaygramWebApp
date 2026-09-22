import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from '../webapp/node_modules/typescript/lib/typescript.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import * as physics from '../webapp/src/games/blackwater/shared/physics.mjs';
import * as terrain from '../webapp/src/games/blackwater/shared/terrain.mjs';
import * as brains from '../webapp/src/games/blackwater/shared/botBrain.mjs';
import * as battle from '../webapp/src/games/blackwater/shared/battlefield.mjs';
import * as mission from '../webapp/src/games/blackwater/shared/missionCore.mjs';
import * as feedback from '../webapp/src/games/blackwater/shared/shotFeedback.mjs';
import * as tactics from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
function loadEngine() {
  const module={exports:{}},deps={'three':T,'./core':physics,'./shared/terrain.mjs':terrain,
    './shared/botBrain.mjs':brains,'./shared/battlefield.mjs':battle,'./shared/missionCore.mjs':mission,
    './shared/shotFeedback.mjs':feedback,'../tiranastreets/shared/forceTactics.mjs':tactics,
    './compatibility':{CompatibilityRenderer:class {}}};
  const file='webapp/src/games/blackwater/engine.ts';
  const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require:key=>deps[key]||{},console,Math,performance},{filename:file});
  return module.exports.GameEngine;
}
const GameEngine=loadEngine();
const copy=p=>({x:p.x,y:p.y,z:p.z});
function combatant(id,x,z) {
  const e={id,group:new T.Group(),flash:new T.Object3D(),legs:[new T.Object3D(),new T.Object3D()],hp:100,
    brain:brains.createBrain(String(id)),flashTime:0,hurt:0,deadTime:0,cooldown:0,repath:0,path:[],walk:0};
  e.group.position.set(x,terrain.battleGround(x,z),z);return e;
}
function fixture({wall=false,enemy=true}={}) {
  const calls={shot:[],blood:[],surface:[]},camera=new T.PerspectiveCamera(70,390/844,.1,500);
  camera.position.set(0,terrain.battleGround(0,0)+1.16,0);
  const target=combatant(0,0,-10);
  camera.lookAt(0,target.group.position.y+1.16,-10);camera.updateMatrixWorld(true);
  const obstacles=wall?[{x:0,z:-5,w:8,d:1,h:8}]:[];
  const muzzle=new T.Object3D();muzzle.position.copy(camera.position);
  const game=Object.assign(Object.create(GameEngine.prototype),{
    phase:'playing',weapon:'ar',health:100,maxHealth:100,player:{x:0,z:0},elapsed:1,
    vehicle:{driving:false},reloadTimer:0,cooldown:0,ammo:30,reserve:100,shots:0,hits:0,kills:0,score:0,
    recoil:0,kick:0,damageMultiplier:1,input:{aiming:true},camera,rng:()=>.5,
    world:{obstacles,muzzle,gunLight:{intensity:0}},audio:{shot(){},hit(){},kill(){},reload(){}},
    enemies:enemy?[target]:[],impactEvents:[],impactSerial:0,loot:[],
    combatEffects:{shot:(a,b)=>calls.shot.push([copy(a),copy(b)]),blood:(a,b,floor)=>calls.blood.push({at:copy(a),direction:copy(b),floor}),
      surfaceHit:(a,b,kind,floor)=>calls.surface.push({at:copy(a),normal:copy(b),kind,floor})}
  });
  return {game,calls,target};
}

test('actual Battlefield shooting damages the nearest confirmed human and emits blood only for that hit',()=>{
  const {game,calls,target}=fixture();game.shoot();
  assert.equal(game.ammo,29);assert.equal(game.shots,1);assert.equal(game.hits,1);
  assert.equal(target.hp,100-physics.WEAPONS.ar.damage);assert.equal(calls.blood.length,1);
  assert.equal(calls.surface.length,0);assert.equal(game.impactEvents.length,0);
  assert.ok(calls.blood[0].at.z>-10&&calls.blood[0].at.z<-9,'blood is emitted at the actual front-facing hit volume');
  assert.equal(calls.blood[0].floor,terrain.battleGround(calls.blood[0].at.x,calls.blood[0].at.z));
  game.shoot();assert.equal(game.shots,1,'fire-rate cooldown also suppresses duplicate feedback');
});

test('a real collision wall stops damage and blood, and creates one surface-directed bullet mark',()=>{
  const {game,calls,target}=fixture({wall:true});game.shoot();
  assert.equal(target.hp,100);assert.equal(game.hits,0);assert.equal(calls.blood.length,0);
  assert.equal(calls.surface.length,1);assert.equal(calls.surface[0].kind,'wall');
  assert.ok(Math.abs(calls.surface[0].at.z+4.5)<1e-6);assert.equal(calls.surface[0].normal.z,1);
  assert.equal(game.impactEvents.length,1);assert.equal(game.impactEvents[0].hitKind,'wall');
  assert.ok(Math.abs(calls.shot[0][1].z+4.5)<1e-6,'tracer terminates on the same wall that blocks damage');
});

test('shooting sky creates a bounded tracer without phantom bullet damage or blood',()=>{
  const {game,calls}=fixture({enemy:false});game.camera.position.y=1000;
  game.camera.lookAt(0,1020,-80);game.camera.updateMatrixWorld(true);game.world.muzzle.position.copy(game.camera.position);game.shoot();
  assert.equal(calls.shot.length,1);assert.equal(calls.blood.length,0);assert.equal(calls.surface.length,0);
  assert.equal(game.impactEvents.length,0);assert.equal(game.hits,0);
  const [from,to]=calls.shot[0];assert.ok(Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z)<110,'tracer never runs beyond weapon range plus muzzle offset');
});

test('actual downward fire finds terrain and emits ground feedback instead of an air decal',()=>{
  const {game,calls}=fixture({enemy:false});game.camera.position.y=terrain.battleGround(0,0)+10;
  game.camera.lookAt(0,terrain.battleGround(0,-3),-3);game.camera.updateMatrixWorld(true);game.shoot();
  assert.equal(calls.surface.length,1);assert.equal(calls.surface[0].kind,'ground');
  assert.ok(calls.surface[0].normal.y>0);assert.equal(calls.blood.length,0);
  assert.equal(game.impactEvents[0].hitKind,'ground');
});

test('sustained real wall fire bounds pending decal events and keeps event IDs ordered',()=>{
  const {game,calls}=fixture({wall:true,enemy:false});game.ammo=300;
  for(let i=0;i<200;i++){game.cooldown=0;game.elapsed+=.15;game.shoot();}
  assert.equal(game.shots,200);assert.equal(calls.blood.length,0);assert.equal(game.impactSerial,200);
  assert.equal(game.impactEvents.length,96);assert.equal(game.impactEvents[0].id,105);
  assert.equal(game.impactEvents.at(-1).id,200);
  assert.ok(game.impactEvents.every((event,index)=>index===0||event.id>game.impactEvents[index-1].id));
});

function aiFixture(mode='sweep') {
  const {game}=fixture({enemy:false});
  Object.assign(game,{battleMode:mode,sectorCenter:{x:0,z:0},intelPoint:{x:10,z:0},extractionPoint:{x:-25,z:0},
    intel:false,player:{x:100,z:0},battleObstacles:[],wave:1,gunNoise:null,difficulty:'recruit',movement:0,rng:()=>1});
  const e=combatant(0,35,0);game.enemies=[e];return {game,e};
}

test('the real enemy update consumes decision movement speed and native walk/run/reload animation states',()=>{
  const patrol=aiFixture(),defender=aiFixture('hold');
  patrol.game.updateEnemy(patrol.e,.05);defender.game.updateEnemy(defender.e,.05);
  const patrolTravel=Math.hypot(patrol.e.group.position.x-35,patrol.e.group.position.z);
  const defendTravel=Math.hypot(defender.e.group.position.x-35,defender.e.group.position.z);
  assert.ok(Math.abs(patrolTravel-2.6*.05)<1e-6);assert.equal(patrol.e.anim,'walk');
  assert.ok(Math.abs(defendTravel-4.1*.05)<1e-6);assert.equal(defender.e.anim,'run');
  patrol.e.brain.ammo=0;patrol.game.updateEnemy(patrol.e,.05);
  assert.ok(patrol.e.brain.reload>0);assert.equal(patrol.e.anim,'reload');
});

test('actual Battlefield facing prevents an immediate shot at an unseen operator behind the bot',()=>{
  const {game,e}=aiFixture();e.group.position.set(0,terrain.battleGround(0,0),0);e.group.rotation.y=0;
  game.player={x:0,z:18};game.elapsed=10;game.updateEnemy(e,.05);
  assert.equal(e.brain.target,null);assert.equal(e.brain.ammo,12);assert.equal(game.health,100);
});

test('the real physics loop persists mission briefing and exposes contested capture progress in the snapshot',()=>{
  const {game,target}=fixture();target.group.position.x=40;
  Object.assign(game,{battleMode:'hold',sectorCenter:{x:0,z:0},intelPoint:{x:15,z:0},extractionPoint:{x:30,z:0},
    objectiveProgress:0,extractProgress:0,intel:false,extraction:false,health:100,maxHealth:100,lastDamage:-100,
    hit:0,hurt:0,swayX:0,swayY:0,messageTime:0,movement:0,footsteps:0,yaw:0,pitch:0,
    input:{keys:new Set(),move:{x:0,y:0},aiming:false,firing:false},settings:{assist:false},
    vehicle:{driving:false,near:()=>false,view:'chase',car:{speed:0}},operations:{completed:[]},inventory:{ar:{ammo:30,reserve:100}},
    renderer:{info:{render:{calls:0,triangles:0}}},wave:1,
    // This fixture keeps the guard in place while exercising the actual mission
    // integration; separate tests above exercise updateEnemy and its movement.
    updateEnemy(){},updateLoot(){},updateCamera(){}
  });
  for(let i=0;i<20;i++)game.physics(.05);
  let snapshot=game.snapshot();assert.equal(snapshot.objectiveStage,'capture');
  assert.ok(Math.abs(snapshot.objectiveProgress-1)<1e-6);assert.ok(snapshot.objectiveRatio>0);
  assert.equal(snapshot.objectiveContested,false);assert.match(snapshot.objectiveHint,/Hold position/);
  assert.ok(snapshot.objectiveTimeRemaining<300);
  target.group.position.set(0,terrain.battleGround(0,0),0);game.physics(.05);
  snapshot=game.snapshot();assert.equal(snapshot.objectiveStage,'contest');assert.equal(snapshot.objectiveContested,true);
  assert.ok(Math.abs(snapshot.objectiveProgress-1)<1e-6);assert.match(snapshot.objectiveHint,/contested/);
  game.renderer={};snapshot=game.snapshot();assert.equal(snapshot.drawCalls,0);assert.equal(snapshot.triangles,0,'Canvas fallback does not require WebGL statistics');
  let finished=0;game.battleMode='last-stand';game.player.x=1000;game.health=.1;
  game.damage=()=>{game.health=0;game.phase='lost';finished++;};
  game.finish=()=>{finished++;};game.physics(.05);assert.equal(finished,1,'zone death is settled only once');
});
