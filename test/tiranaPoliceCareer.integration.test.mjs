import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,FREE_ROAM} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {StreetSimulation} from '../webapp/src/games/tiranastreets/street-career/StreetSimulation.mjs';
import {PoliceCareerController} from '../webapp/src/games/tiranastreets/street-career/PoliceCareerController.mjs';
import {POLICE_UNITS,POLICE_MISSIONS,freshPoliceProfile,beginPoliceMission,normalizePoliceProfile} from '../webapp/src/games/tiranastreets/street-career/policeCareerCore.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';
import {FORCE_VEHICLE_BOUNDS} from '../webapp/src/games/tiranastreets/shared/albanianForces.mjs';
const fixture=()=>{const sim=new StreetSimulation(createState([{id:'local',name:'Officer'}],FREE_ROAM.id,'solo'));
  const profile=beginPoliceMission(freshPoliceProfile(),'shqiponja-lana');return {sim,profile,controller:new PoliceCareerController(sim,profile)};};
function place(sim,target){Object.assign(sim.player,{x:target.x,z:target.z,speed:0,carId:null});Object.assign(sim.body,{y:groundHeight(target.x,target.z)+.08,grounded:true});}
function perform(controller){assert.equal(controller.interact(),true);for(let i=0;i<40&&controller.run.channel;i++){controller.sim.state.elapsed+=.1;controller.step(.1);}}
test('live world operations require the correct actor, range, line of sight, timed action and transport to custody',()=>{
  const {sim,controller:c}=fixture();assert.equal(c.actors.size,4);assert.equal(sim.player.forceCharacter,'shqiponja_officer');assert.equal(c.vehicle.forceVehicle,'shqiponja_compact');
  assert.equal(c.eligible(),false);assert.equal(c.interact(),false);
  const witness=c.actors.get('witness');place(sim,witness);assert.equal(c.eligible(),true);
  const clear=sim.world.clear;sim.world.clear=()=>false;assert.equal(c.eligible(),false);sim.world.clear=clear;
  perform(c);assert.equal(c.run.stage,1);place(sim,c.actors.get('suspect'));perform(c);assert.equal(c.run.stage,2);
  perform(c);assert.equal(c.run.arrested,true);assert.equal(c.run.stage,3);
  place(sim,c.anchors.station);assert.equal(c.eligible(),false,'a suspect left at the scene cannot count as delivered');
  const suspect=c.actors.get('suspect');Object.assign(c.vehicle,{x:suspect.x,z:suspect.z});Object.assign(sim.player,{x:suspect.x,z:suspect.z,carId:c.vehicle.id});c.step(.1);
  assert.equal(suspect.inCustodyVehicle,true);Object.assign(c.vehicle,c.anchors.station);c.step(.1);place(sim,c.anchors.station);
  perform(c);assert.equal(c.run.status,'completed');
});
test('damage attribution remains connected to real simulation and fails harm to a bystander',()=>{
  const {sim,controller:c}=fixture();sim.damage(c.actors.get('witness'),5,sim.player);c.step(.1);
  assert.equal(c.run.status,'failed');assert.match(c.run.failure,/civil/);assert.equal(c.actors.get('witness').health,95);
});
test('duty checkpoint restores positions and arrest state without duplicating actors or auto-completing actions',()=>{
  const {sim,controller:c,profile}=fixture();place(sim,c.actors.get('witness'));perform(c);place(sim,c.actors.get('suspect'));perform(c);perform(c);
  c.snapshot();const saved=normalizePoliceProfile(JSON.parse(JSON.stringify(profile)));
  const next=new StreetSimulation(createState([{id:'local',name:'Officer'}],FREE_ROAM.id,'solo'));
  const restored=new PoliceCareerController(next,saved);assert.equal(restored.run.stage,3);assert.equal(restored.run.arrested,true);assert.equal(restored.run.channel,false);
  assert.equal(next.state.npcs.filter(n=>n.id.startsWith('police-duty-')).length,4);assert.equal(next.state.cars.filter(c=>c.id==='police-duty-vehicle').length,1);
  assert.equal(next.player.weapon,'','duty resumes with weapon lowered');
});
test('every unit spawns its real service vehicle without placing its corners inside city buildings',()=>{
  for(const unit of POLICE_UNITS){
    const sim=new StreetSimulation(createState([{id:'local',name:unit.name}],FREE_ROAM.id,'solo'));
    const profile=beginPoliceMission({...freshPoliceProfile(),unit:unit.id},POLICE_MISSIONS.find(m=>m.unit===unit.id).id);
    const c=new PoliceCareerController(sim,profile),car=c.vehicle,bounds=FORCE_VEHICLE_BOUNDS.find(b=>b.id===unit.vehicle);
    assert.ok(sim.player.inventory[unit.weapon],unit.id);assert.equal(sim.player.forceCharacter,unit.character);assert.ok(c.actors.size<=6);
    for(const side of [-1,1])for(const end of [-1,1]){
      const x=car.x+Math.cos(car.heading)*side*bounds.w/2+Math.sin(car.heading)*end*bounds.d/2;
      const z=car.z-Math.sin(car.heading)*side*bounds.w/2+Math.cos(car.heading)*end*bounds.d/2;
      assert.equal(sim.world.clearance({x,z,y:groundHeight(x,z)+.08},bounds.h,.3),true,`${unit.id}: blocked vehicle corner`);
    }
  }
});
