import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {racingActivity} from '../webapp/src/games/kartroyale/racingModeCore.mjs';
import {createHeldRaceInput} from '../webapp/src/games/kartroyale/heldRaceInput.mjs';
import {KART_TASKS,freshKartTasks,finishKartTask,normalizeKartTasks,kartTaskXP,loadKartTasks,saveKartTasks} from '../webapp/src/games/kartroyale/kartTaskCore.mjs';
import {buildRaceCatalog} from '../webapp/src/games/kartroyale/raceCatalog.mjs';
const routes=JSON.parse(readFileSync(new URL('./fixtures/tiranaRaceSourcePair.json',import.meta.url))).routes;
const original={id:'lana',name:'Lana',width:10},oldCup={name:'Original',track:'lana',target:3};
const legacy={TRACKS:[original],CUPS:[oldCup],makeTrack:()=>original};
function result(task,extra={}){return {trackId:task.track,playerId:'you',racers:[{id:'you',finished:true,finishTime:180,health:100,...extra}]};}
test('supplied Alpine game opens directly by default and for free AI URLs',()=>{
 assert.equal(racingActivity(''),'alpine');assert.equal(racingActivity('?mode=ai'),'alpine');
 assert.equal(racingActivity('?activity=garage'),'race');
});
test('paid multiplayer/table URLs take priority over Explore or local Career',()=>{
 for(const paid of ['mode=online','tableId=paid-seat','code=ABC123'])assert.equal(racingActivity(`?${paid}&activity=explore`),'race');
});
test('explicit free Explore and kart-career URLs still open their own activities',()=>{
 assert.equal(racingActivity('?mode=ai&activity=explore'),'explore');assert.equal(racingActivity('?activity=racing-career'),'career');assert.equal(racingActivity('?mode=career'),'career');
});
test('releasing a boost finger retains a separately held steering finger',()=>{
 const input=createHeldRaceInput();input.hold('finger1','steer',1);input.hold('finger2','boost',true);input.release('finger2');assert.deepEqual(input.read(),{steer:1,brake:false,boost:false,drift:false});
});
test('pointer cancel only releases its owner, not the held brake',()=>{
 const input=createHeldRaceInput();input.hold('finger1','steer',-1);input.hold('finger2','brake',true);input.release('finger1');assert.deepEqual(input.read(),{steer:0,brake:true,boost:false,drift:false});
});
test('screen-left and screen-right steering are not inverted',()=>{
 const input=createHeldRaceInput();input.hold('left','steer',-1);assert.equal(input.read().steer,-1);input.release('left');input.hold('right','steer',1);assert.equal(input.read().steer,1);
});
test('keyboard and touch can share a control without stuck input on release',()=>{
 const input=createHeldRaceInput();input.hold('key:a','steer',-1);input.hold('finger1','steer',-1);input.release('finger1');assert.equal(input.read().steer,-1);input.clear();assert.equal(input.read().steer,0);
});
test('malformed input is rejected and each snapshot is independent',()=>{
 const input=createHeldRaceInput();input.hold('x','steer',NaN);input.hold('y','fire',true);const frame=input.read();frame.steer=99;assert.equal(input.read().steer,0);input.hold('x','steer',99);assert.equal(input.read().steer,1);
});
test('new driving missions are kart races with independent objectives',()=>{
 assert.equal(KART_TASKS.length,4);assert.ok(KART_TASKS.every(t=>t.track&&t.xp>0));assert.ok(KART_TASKS.some(t=>t.seconds));assert.ok(KART_TASKS.some(t=>t.health));assert.ok(KART_TASKS.some(t=>t.place));
});
test('later kart mission cannot be awarded before earlier ones',()=>{
 assert.equal(finishKartTask(freshKartTasks(),KART_TASKS[1].id,result(KART_TASKS[1])).complete,false);
});
test('wrong track, incomplete, disconnected, retired and invalid times cannot pass a task',()=>{
 const t=KART_TASKS[0],profile=freshKartTasks();
 for(const bad of [{finished:false},{retired:true},{disconnected:true},{finishTime:NaN},{finishTime:0},{finishTime:481}])assert.equal(finishKartTask(profile,t.id,result(t,bad)).complete,false);
 assert.equal(finishKartTask(profile,t.id,{...result(t),trackId:'other'}).complete,false);
});
test('all four tasks complete sequentially and award only first-completion XP',()=>{
 let p=freshKartTasks();for(const t of KART_TASKS){const r=finishKartTask(p,t.id,result(t));assert.equal(r.complete,true);p=r.profile;}
 assert.equal(p.completed.length,4);assert.equal(kartTaskXP(p),700);
 const replay=finishKartTask(p,KART_TASKS[0].id,result(KART_TASKS[0],{finishTime:160}));assert.equal(replay.xp,0);assert.equal(replay.profile.best[KART_TASKS[0].id],160);assert.equal(p.best[KART_TASKS[0].id],180);
});
test('time and kart-damage mission failures keep progress unchanged',()=>{
 const t=KART_TASKS[0];assert.equal(finishKartTask(freshKartTasks(),t.id,result(t,{finishTime:421})).complete,false);
 const p=finishKartTask(freshKartTasks(),t.id,result(t)).profile;
 assert.equal(finishKartTask(p,KART_TASKS[1].id,result(KART_TASKS[1],{health:74})).complete,false);
});
test('podium position is derived from finish times rather than arbitrary result ordering',()=>{
 let p=freshKartTasks();for(const t of KART_TASKS.slice(0,2))p=finishKartTask(p,t.id,result(t)).profile;
 const r=result(KART_TASKS[2]);r.racers.push(...[1,2,3].map(id=>({id:String(id),finished:true,finishTime:100+id,health:100})));
 assert.equal(finishKartTask(p,KART_TASKS[2].id,r).complete,false);
});
test('corrupt storage and non-sequential forged completion sets are normalized',()=>{
 assert.deepEqual(loadKartTasks({getItem(){throw Error('blocked');}}),freshKartTasks());
 assert.deepEqual(normalizeKartTasks({version:1,completed:[KART_TASKS[3].id]}),freshKartTasks());
 assert.equal(saveKartTasks(undefined,freshKartTasks()),false);
});
test('task saves use their own key and cannot overwrite the original cup progression',()=>{
 const writes=[];assert.equal(saveKartTasks({setItem(k,v){writes.push([k,v]);}},freshKartTasks()),true);
 assert.equal(writes[0][0],'tonplaygram.kartroyale.tasks.v1');assert.notEqual(writes[0][0],'tonplaygram.kartroyale.career.v1');
});
test('mapped Grand is retained without searching WORLD on the startup thread',()=>{
 const c=buildRaceCatalog(legacy,routes),grand=c.makeTrack('lana-pyramid-grand');assert.equal(grand.points.length,360);assert.ok(grand.length>1990&&grand.length<2000);assert.equal(c.tracks[0],original);assert.equal(c.cups[0],oldCup);assert.equal(c.makeTrack('lana'),original);
 const source=readFileSync(new URL('../webapp/src/games/kartroyale/simulation.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/WORLD|roadGraph\(|extendMappedRoute\(/);
});
test('a broken optional Grand source cannot prevent the original garage/circuits from importing',()=>{
 const c=buildRaceCatalog(legacy,[]);assert.equal(c.tracks.length,1);assert.equal(c.makeTrack('lana'),original);assert.equal(c.diagnostics.length,1);assert.throws(()=>c.makeTrack('unknown-grand'),/unavailable/);
});
