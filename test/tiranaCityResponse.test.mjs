import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {unifiedEntry} from '../webapp/src/games/blackwater/unifiedEntry.mjs';
import {makeRoom} from '../webapp/src/games/tiranastreets/shared/rooms.mjs';
import {WEAPONS, STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';
import {captureCheckpoint, normalizeCheckpoint, restoreCheckpoint} from '../webapp/src/games/tiranastreets/street-career/checkpointCore.mjs';
import {createCampaign} from '../webapp/src/games/tiranastreets/street-career/campaignCore.mjs';
import {operationTarget} from '../webapp/src/games/tiranastreets/street-career/operationRoute.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';

const id = 'operation-city-response';
const campaign = createCampaign(MISSIONS, WEAPONS, STARTER_WEAPON);
function create() {
  const state = createState([{id:'local', name:'Driver'}], id, 'solo');
  const sim = new StreetSimulation(state, new StreetWorld([], false));
  state.npcs=[]; state.traffic=[]; state.units=[]; state.cars=[];
  state.nextDispatch=1e9; state.cityEvent.enabled=false;
  return sim;
}
function place(sim, target, driving=false) {
  const p=sim.player;
  Object.assign(p,{x:target.x,z:target.z,speed:0,wanted:0,carId:driving?'response-car':null});
  Object.assign(sim.body,{y:groundHeight(p.x,p.z)+.08,grounded:true,interaction:driving?'driving':'free',yaw:0,pitch:-.4});
  sim.intent.yaw=0;sim.intent.pitch=-.4;sim.intent.brake=driving;
  sim.state.cars=driving?[{id:'response-car',model:'sedan',driver:'local',x:p.x,z:p.z,heading:0,speed:0,vx:0,vz:0,steering:0,health:140}]:[];
  sim.job.vehicleId=driving?'response-car':null;
}
function tick(sim, seconds) {for(let t=0;t<seconds-1e-8;t+=1/60)sim.step(1/60);}

test('City response requires driving, on-foot recovery and a safe parked extraction in order',()=>{
  const sim=create(),m=sim.mission,d=sim.job.director;
  place(sim,m.stops[0],true);tick(sim,3.2);
  assert.equal(sim.player.finished,false,'driving straight to final cannot skip the job');
  place(sim,m.approach);tick(sim,1.2);assert.equal(d.operationStage,'approach','walking to staging is not driving');
  place(sim,m.approach,true);
  sim.player.speed=1;for(let i=0;i<15;i++)sim.updateObjective(.1);
  assert.equal(d.operationStage,'approach','rolling through at walking pace is not parked');
  sim.player.speed=0;tick(sim,1.1);
  assert.equal(d.operationStage,'secure');assert.deepEqual(operationTarget(m,d),m.combatZone);
  assert.equal(sim.objective().stage,2);
  place(sim,{x:m.combatZone.x,z:m.combatZone.z+2});
  sim.state.objectiveRemaining=1;
  sim.finishInteract({targetId:'objective:0'});
  assert.equal(d.operationStage,'secure','cannot recover while an opponent remains');
  sim.state.objectiveRemaining=0;
  assert.equal(sim.execute('interact','objective:0'),true);
  tick(sim,.65);assert.equal(d.operationStage,'escape');
  assert.deepEqual(operationTarget(m,d),m.stops[0]);
  place(sim,m.stops[0]);tick(sim,3.2);assert.equal(sim.player.finished,false,'must deliver by car');
  place(sim,m.stops[0],true);
  sim.player.wanted=100;for(let i=0;i<40;i++)sim.updateObjective(.1);
  assert.equal(d.hold,0,'wanted level prevents safe extraction');
  sim.player.wanted=0;tick(sim,1.5);assert.equal(sim.player.finished,false);
  sim.player.lastDamage=sim.state.elapsed;sim.updateObjective(1/60);assert.equal(d.hold,0,'armor hits interrupt parking hold');
  tick(sim,3.1);assert.equal(sim.player.finished,true);assert.equal(sim.state.phase,'finished');
  let profile=campaign.begin(campaign.fresh(),id);
  profile=campaign.resolve(profile,sim.state,'local');assert.ok(profile.completed.includes(id));
  const cash=profile.loadout.cash;
  profile=campaign.begin(profile,id);
  sim.player.cash=cash;
  assert.equal(campaign.resolve(profile,sim.state,'local').loadout.cash,cash,'replay does not pay twice');
});

test('mixed-operation progress, route and dispatch survive save/reload',()=>{
  const sim=create(),m=sim.mission;
  for(const stage of ['approach','secure','escape']) {
    place(sim,m.approach,true);
    sim.job.director.operationStage=stage;
    sim.job.director.hold=stage==='escape'?1.5:0;
    const phase=normalizeCheckpoint(captureCheckpoint(sim),x=>x,m.stops.length);
    const restored=create();
    assert.equal(restoreCheckpoint(restored,phase,campaign.apply),true);
    assert.equal(restored.job.director.operationStage,stage);
    assert.equal(restored.job.director.hold,sim.job.director.hold);
    assert.deepEqual(operationTarget(m,restored.job.director),operationTarget(m,sim.job.director));
  }
});

// The local director owns these stages; server rooms must not bypass them.
test('mixed operation stays out of shared online rooms',()=>{
  for(const mode of ['rivals','coop','career'])
    assert.throws(()=>makeRoom('test',{id:'a',name:'A'},{missionId:id,mode}),/Choose a mission/);
});

test('legacy Lana entry continues to launch River corridor',()=>{
  assert.equal(unifiedEntry('?mode=ai&map=lana').operation,'operation-lana');
  assert.equal(unifiedEntry('?mode=ai&map=city-response').operation,id);
  assert.equal(unifiedEntry('?activity=career&map=city-response').operation,undefined);
});
