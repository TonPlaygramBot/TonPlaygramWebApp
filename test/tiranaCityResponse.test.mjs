import test from 'node:test';
import assert from 'node:assert/strict';
import {createState, MISSIONS} from '../webapp/src/games/tiranastreets/shared/engine.mjs';

import {makeRoom} from '../webapp/src/games/tiranastreets/shared/rooms.mjs';
import {WEAPONS, STARTER_WEAPON} from '../webapp/src/games/tiranastreets/shared/weapons.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';

import {operationTarget} from '../webapp/src/games/tiranastreets/street-career/operationRoute.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';

const id = 'operation-city-response';

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

// The local director owns these stages; server rooms must not bypass them.
test('mixed operation stays out of shared online rooms',()=>{
  for(const mode of ['rivals','coop','career'])
    assert.throws(()=>makeRoom('test',{id:'a',name:'A'},{missionId:id,mode}),/Choose a mission/);
});
