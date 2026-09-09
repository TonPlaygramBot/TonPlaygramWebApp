import test from 'node:test';import assert from 'node:assert/strict';
import {KART_MISSIONS,normalizeKartJobs,availableKartJob,completeKartJob,KartControlState} from '../webapp/src/games/kartroyale/kartMissionCore.mjs';
function result(m,patch={}){return {trackId:m.track,playerId:'you',racers:[{id:'you',finished:true,retired:false,health:100,finishTime:200,...patch}],elapsed:201};}
test('all kart jobs run on existing Tirana circuits with stable IDs',()=>{assert.equal(new Set(KART_MISSIONS.map(m=>m.id)).size,KART_MISSIONS.length);for(const m of KART_MISSIONS)assert.ok(['skanderbeg','lana','blloku','pyramid','stadium'].includes(m.track));});
test('kart career requires sequential progression and never trusts a future completion',()=>{assert.equal(availableKartJob({},KART_MISSIONS[1].id),false);assert.deepEqual(normalizeKartJobs({completed:[KART_MISSIONS[3].id]}).completed,[]);});
test('all six missions complete and first-completion rewards cannot be duplicated',()=>{let jobs={},total=0;for(const m of KART_MISSIONS){const n=completeKartJob(jobs,m.id,result(m),100);assert.equal(n.success,true,m.id);total+=n.reward;jobs=n.jobs;assert.equal(completeKartJob(jobs,m.id,result(m),100).reward,0);}assert.equal(jobs.completed.length,6);assert.equal(total,1460);});
test('wrong track, retirement and unfinished or invalid-time results cannot pass',()=>{const m=KART_MISSIONS[0];for(const r of [{...result(m),trackId:'invented'},result(m,{retired:true}),result(m,{finished:false}),result(m,{finishTime:NaN}),result(m,{finishTime:-1})])assert.equal(completeKartJob({},m.id,r,100).success,false);});
test('clean-run health uses the lowest observed health, not just the finish value',()=>{const m=KART_MISSIONS[2],jobs={completed:KART_MISSIONS.slice(0,2).map(m=>m.id)};assert.equal(completeKartJob(jobs,m.id,result(m),64).success,false);assert.equal(completeKartJob(jobs,m.id,result(m),65).success,true);});
test('timed and podium jobs enforce their objectives',()=>{const m=KART_MISSIONS[3],jobs={completed:KART_MISSIONS.slice(0,3).map(m=>m.id)};assert.equal(completeKartJob(jobs,m.id,result(m,{finishTime:301}),100).success,false);const podium=KART_MISSIONS[1],r=result(podium);r.racers.unshift({id:'a'},{id:'b'},{id:'c'});assert.equal(completeKartJob({completed:[KART_MISSIONS[0].id]},podium.id,r,100).success,false);});
test('releasing boost retains held steering and drift',()=>{const c=new KartControlState();c.hold('touch-1','steer',1);c.hold('touch-2','boost');c.hold('key-shift','drift');c.release('touch-2');assert.deepEqual(c.read(),{steer:1,brake:false,boost:false,drift:true});});
test('opposite keys cancel and releasing one retains the other',()=>{const c=new KartControlState();c.hold('left','steer',-1);c.hold('right','steer',1);assert.equal(c.read().steer,0);c.release('right');assert.equal(c.read().steer,-1);});
test('pause clears ownership; hidden/released pointers cannot restore old input',()=>{const c=new KartControlState();c.hold('a','boost');c.setEnabled(false);c.hold('b','steer',1);c.setEnabled(true);assert.deepEqual(c.read(),{steer:0,brake:false,boost:false,drift:false});});
test('malformed stored progress cannot create rewards or best times',()=>{for(const raw of [null,{},'bad',{completed:'bad'},{completed:[],best:{x:1}}])assert.deepEqual(normalizeKartJobs(raw),{completed:[],best:{}});});
import {racingEntry} from '../webapp/src/games/kartroyale/racingModes.mjs';
test('AI, career and Explore deep links enter the correct independent game',()=>{assert.equal(racingEntry('?mode=ai'),'ai');assert.equal(racingEntry('?mode=ai&activity=explore'),'explore');assert.equal(racingEntry('?activity=racing-career'),'career');assert.equal(racingEntry(''),'modes');});
test('paid online/table routes cannot be redirected into a free mode',()=>{assert.equal(racingEntry('?mode=online&activity=explore'),'online');assert.equal(racingEntry('?tableId=seat&activity=racing-career'),'online');});
test('malformed results and NaN health cannot satisfy a kart objective',()=>{const first=KART_MISSIONS[0];for(const r of [null,{}, {trackId:first.track,racers:'bad'}])assert.equal(completeKartJob({},first.id,r,100).success,false);const clean=KART_MISSIONS[2];assert.equal(completeKartJob({completed:KART_MISSIONS.slice(0,2).map(m=>m.id)},clean.id,result(clean,{health:NaN}),100).success,false);});
import {loadGameModule} from './helpers/loadGameModule.cjs';
import * as missionModule from '../webapp/src/games/kartroyale/kartMissionCore.mjs';
test('actual career save/reload preserves new jobs, original cups and non-duplicate rewards',()=>{
  let raw=JSON.stringify({version:1,cups:[3,1,0],best:{lana:200},credits:400,races:7,wins:2});
  const storage={getItem:()=>raw,setItem(k,v){assert.equal(k,'tonplaygram.kartroyale.career.v1');raw=v;}};
  const mod=loadGameModule('webapp/src/games/kartroyale/career.ts',{'./simulation.mjs':{CUPS:[{track:'skanderbeg'},{track:'blloku'},{track:'lana'}]},'./kartMissionCore.mjs':missionModule},{localStorage:storage});
  const c=mod.loadCareer(),m=KART_MISSIONS[0],n=mod.recordKartMission(c,m.id,result(m),100);assert.equal(n.saved,true);assert.equal(n.career.credits,500);
  const reloaded=mod.loadCareer();assert.equal(reloaded.jobs.completed[0],m.id);assert.equal(reloaded.cups[0],3);assert.equal(reloaded.cups[1],1);assert.equal(reloaded.best.lana,200);
  assert.equal(mod.recordKartMission(reloaded,m.id,result(m),100).reward,0);
});
