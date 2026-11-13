import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require = createRequire(new URL('../webapp/package.json', import.meta.url));
const {build} = require('esbuild');
const temp = await mkdtemp(join(tmpdir(), 'tirana-controls-test-'));
await build({entryPoints: ['webapp/src/games/tiranastreets/renderSettings.ts','webapp/src/games/tiranastreets/street-career/settings.ts','webapp/src/games/blackwater/engine.ts'],bundle:true,platform:'node',format:'esm',entryNames:'[name]',outExtension:{'.js':'.mjs'},outdir:temp});
const {FramePacer, FRAME_RATES, targetFps, CITY_RADIUS, beginCityFrame, runCityWork} = await import(pathToFileURL(join(temp,'renderSettings.mjs')));
const {loadSettings} = await import(pathToFileURL(join(temp,'settings.mjs')));
const {GameEngine} = await import(pathToFileURL(join(temp,'engine.mjs')));
test.after(()=>rm(temp,{recursive:true,force:true}));
for (const hz of [60,90,120]) for (const fps of FRAME_RATES) {
  test(`${fps} FPS target on ${hz} Hz display retains frame deadlines`,()=>{
    const pacer=new FramePacer();let count=0;
    for(let i=0;i<hz*10;i++)if(pacer.shouldRender(i*1000/hz,fps))count++;
    assert.ok(Math.abs(count-Math.min(fps,hz)*10)<=1,`${count} frames`);
  });
}
test('changing targets applies immediately and a background gap never bursts',()=>{
  const p=new FramePacer();assert.equal(p.shouldRender(0,50),true);
  assert.equal(p.shouldRender(8,50),false);assert.equal(p.shouldRender(8,120),true);
  assert.equal(p.shouldRender(30000,120),true);assert.equal(p.shouldRender(30000,120),false);
});
test('legacy/corrupt settings migrate without dropping existing controls',()=>{
  const load=value=>loadSettings({getItem:()=>JSON.stringify(value)});
  assert.equal(load({sensitivity:1.5}).sensitivity,1.5);assert.equal(load({}).targetFps,60);
  for(const fps of FRAME_RATES)assert.equal(load({targetFps:fps,quality:'battery'}).targetFps,fps);
  assert.equal(load({targetFps:10000,quality:'ultra'}).targetFps,60);
  assert.equal(load({targetFps:10000,quality:'ultra'}).quality,'auto');
  assert.equal(loadSettings({getItem:()=>'{broken'}).targetFps,60);
  assert.equal(loadSettings({getItem:()=>{throw Error('denied');}}).quality,'auto');
  for(const value of [NaN,0,-1,'120',null])assert.equal(targetFps(value),60);
});
function armed() {
  const g=Object.assign(Object.create(GameEngine.prototype),{online:null,phase:'playing',health:100,weapon:'ak47',ammo:11,reserve:29,
    inventory:{ak47:{ammo:30,reserve:90},uzi:{ammo:7,reserve:21}},vehicle:{driving:false},reloadTimer:1.2,pendingReload:true,cooldown:.1,
    input:{firing:true,aiming:true},playerVisual:{rig:{prepare:async()=>{}}},emit(){}});
  return g;
}
function joining() {
  const errors=[];
  const input={active:false,keys:new Set(),move:{x:0,y:0},firing:false,aiming:false,crouching:false,sprinting:false,
    clear(){this.keys.clear();this.move={x:0,y:0};this.firing=this.aiming=this.crouching=this.sprinting=false;}};
  const game=Object.assign(Object.create(GameEngine.prototype),{playerReady:false,disposed:false,phase:'playing',
    online:{playerId:'local',send(){}},onlineState:null,input,player:{x:0,z:0},health:100,yaw:0,pitch:0,recoil:0,
    playerVisual:{errors:[],rig:{errors:[]}},enemies:[],settings:{sensitivity:1},
    audio:{start(){}},errorCallback:message=>errors.push(message),emit(){}});
  const state={status:'playing',elapsed:0,players:[{id:'local',hp:100,x:0,z:0,weapon:'ak47',ammo:30,reserve:90,kills:0,shots:0,hits:0,medkits:1,reload:0}]};
  return {game,errors,state};
}
test('authoritative online state and Resume cannot enable input before the chosen rig and weapon finish loading',()=>{
  const {game,state}=joining();game.acceptOnlineState(state);assert.equal(game.input.active,false);
  game.phase='paused';game.resume();assert.equal(game.phase,'playing');assert.equal(game.input.active,false);
  game.input.active=true;game.input.keys.add('KeyW');game.input.firing=true;game.input.aiming=true;game.input.crouching=true;
  game.pendingReload=game.pendingHeal=true;
  const packet=game.onlineControls();
  for(const flag of ['fire','aim','crouch','sprint','reload','heal'])assert.equal(packet[flag],false,flag);
  assert.equal(packet.rx,0);assert.equal(packet.forward,0);
  game.input.active=false;game.input.clear();game.pendingReload=game.pendingHeal=false;
  game.look(20,-20);game.toggleAim();game.toggleCrouch();game.beginFire();game.reload();game.heal();
  assert.equal(game.yaw,0);assert.equal(game.pitch,0);assert.equal(game.input.firing,false);assert.equal(game.pendingReload,false);assert.equal(game.pendingHeal,false);
});
test('successful asset loading enables an already playing match and discards touches made during loading',()=>{
  const {game,state}=joining();game.acceptOnlineState(state);game.input.keys.add('KeyW');game.input.firing=true;
  game.finishPlayerLoad();assert.equal(game.playerReady,true);assert.equal(game.input.active,true);assert.equal(game.input.keys.size,0);assert.equal(game.input.firing,false);
  game.input.keys.add('KeyW');game.look(20,-20);assert.ok(game.onlineControls().forward>0);assert.ok(game.yaw<0&&game.pitch>0);
});
test('failed character or weapon loading stays blocked across later online updates and Resume',()=>{
  for(const target of ['character','weapon']){
    const {game,state,errors}=joining();(target==='character'?game.playerVisual.errors:game.playerVisual.rig.errors).push('download failed');
    game.finishPlayerLoad();assert.equal(errors.length,1);assert.equal(game.playerReady,false);
    game.acceptOnlineState(state);game.phase='paused';game.resume();assert.equal(game.input.active,false,target);
  }
});
test('asset completion respects a paused, waiting or disposed game',()=>{
  for(const patch of [{phase:'paused'},{onlineState:{status:'waiting'}},{disposed:true}]){
    const {game,state}=joining();game.acceptOnlineState(state);Object.assign(game,patch);game.finishPlayerLoad();assert.equal(game.input.active,false);
    if(game.disposed)assert.equal(game.playerReady,false);
  }
});
test('switching and returning preserves exact magazines/reserves and cancels reload without a free refill',()=>{
  const g=armed();assert.equal(g.switchWeapon('uzi'),true);assert.equal(g.weapon,'uzi');assert.equal(g.ammo,7);assert.equal(g.reserve,21);
  assert.equal(g.reloadTimer,0);assert.equal(g.pendingReload,false);assert.equal(g.cooldown,.1);assert.equal(g.input.firing,false);
  g.ammo=3;g.reserve=10;assert.equal(g.switchWeapon('ak47'),true);assert.equal(g.ammo,11);assert.equal(g.reserve,29);
  assert.equal(g.switchWeapon('uzi'),true);assert.equal(g.ammo,3);assert.equal(g.reserve,10);
});
test('unowned, dead, paused, driving and online switching cannot alter loadout',()=>{
  for(const patch of [{},{health:0},{phase:'paused'},{vehicle:{driving:true}},{online:{}}]){
    const g=Object.assign(armed(),patch),before=JSON.stringify(g.inventory),id=Object.keys(patch).length?'uzi':'mosin';
    assert.equal(g.switchWeapon(id),false);assert.equal(g.weapon,'ak47');assert.equal(g.ammo,11);assert.equal(JSON.stringify(g.inventory),before);
  }
});
test('every career weapon thumbnail is present and is a small WebP',async()=>{
  const {WEAPONS}=await import('../webapp/src/games/tiranastreets/shared/weapons.mjs');
  for(const w of WEAPONS.filter(w=>!['fpsGunAttack','punch','egg','tomato'].includes(w.id))){
    const b=await readFile(`webapp/public/assets/tirana-streets/weapon-thumbnails/${w.id}.webp`);
    assert.equal(b.toString('utf8',8,12),'WEBP',w.id);assert.ok(b.length<30000,w.id);
  }
  assert.ok(CITY_RADIUS.high>2400);assert.ok(CITY_RADIUS.battery>1400);
});

test('shared CPU budget is bounded and legacy direct hosts start a fresh frame',()=>{
  let calls=0,blocked=0;
  const slow={run(){calls++;const until=performance.now()+5;while(performance.now()<until){}}};
  const other={run(){blocked++;}};
  beginCityFrame(120);runCityWork(slow,false);runCityWork(other,false);
  assert.equal(calls,1);assert.equal(blocked,0);
  runCityWork(slow,false);assert.equal(calls,2);
});
