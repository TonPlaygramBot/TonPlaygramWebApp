import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICE_UNITS,POLICE_MISSIONS,freshPoliceProfile,normalizePoliceProfile,beginPoliceMission,policeStage,interactPoliceMission,stepPoliceMission,settlePoliceMission,policeMissionAvailable} from '../webapp/src/games/tiranastreets/street-career/policeCareerCore.mjs';
const ready={eligible:true,health:100};
function complete(profile){const run=profile.active;while(run.status==='active'){
  assert.equal(interactPoliceMission(run,ready),true);
  const duration=policeStage(run).seconds;for(let i=0;i<duration*10+1&&run.channel;i++)stepPoliceMission(run,ready,.1);
}return settlePoliceMission(profile);}
test('three independent units offer nine actual staged operations with protected protest and VIP transport',()=>{
  assert.equal(POLICE_UNITS.length,3);assert.equal(POLICE_MISSIONS.length,9);
  for(const unit of POLICE_UNITS){let p={...freshPoliceProfile(),unit:unit.id};const missions=POLICE_MISSIONS.filter(m=>m.unit===unit.id);
    assert.equal(policeMissionAvailable(p,missions[0].id),true);assert.equal(beginPoliceMission(p,missions[1].id),null);
    for(const m of missions){p=complete(beginPoliceMission(p,m.id));assert.ok(p.completed.includes(m.id));}
    const earned=p.merit;p=complete(beginPoliceMission(p,missions[0].id));assert.equal(p.merit,earned);
    assert.equal(p.completed.length,3);assert.deepEqual(normalizePoliceProfile(JSON.parse(JSON.stringify(p))),p);
  }
});
test('arrival alone, pause, invalid dt and a skipped stage cannot award merit',()=>{
  const p=beginPoliceMission(freshPoliceProfile(),'shqiponja-lana'),run=p.active;
  for(let i=0;i<100;i++)stepPoliceMission(run,ready,.1);
  assert.equal(run.stage,0);assert.equal(settlePoliceMission(p),null);
  interactPoliceMission(run,ready);const elapsed=run.elapsed;
  stepPoliceMission(run,{...ready,paused:true},30);stepPoliceMission(run,ready,NaN);assert.equal(run.elapsed,elapsed);
  run.status='completed';const invalid=settlePoliceMission(p);assert.equal(invalid.merit,0);assert.equal(invalid.lastResult.success,false);
});
test('interrupted actions reset continuous hold; restored saves require a new interaction',()=>{
  const p=beginPoliceMission(freshPoliceProfile(),'shqiponja-lana'),run=p.active;
  interactPoliceMission(run,ready);for(let i=0;i<12;i++)stepPoliceMission(run,ready,.1);
  assert.ok(run.hold>1);stepPoliceMission(run,{...ready,eligible:false},.1);assert.equal(run.hold,0);assert.equal(run.channel,false);
  interactPoliceMission(run,ready);stepPoliceMission(run,ready,.1);
  const restored=normalizePoliceProfile(JSON.parse(JSON.stringify(p)));assert.equal(restored.active.hold,0);assert.equal(restored.active.channel,false);assert.equal(restored.active.stage,0);
});
test('civilian harm, protected person loss, vehicle destruction, death and timeout all fail without payout',()=>{
  for(const frame of [{civilianHarmed:true},{protectedLost:true},{vehicleDestroyed:true},{health:0},{arrested:true}]){
    const p=beginPoliceMission(freshPoliceProfile(),'shqiponja-lana');interactPoliceMission(p.active,ready);stepPoliceMission(p.active,{...ready,...frame},.1);
    const result=settlePoliceMission(p);assert.equal(result.merit,0);assert.equal(result.lastResult.success,false);assert.deepEqual(result.completed,[]);
  }
  const p=beginPoliceMission(freshPoliceProfile(),'shqiponja-lana');p.active.elapsed=899.99;stepPoliceMission(p.active,ready,.1);assert.equal(p.active.status,'failed');
});
test('cancelled duties and malformed saves preserve earned merit without granting anything',()=>{
  let p=complete(beginPoliceMission(freshPoliceProfile(),'shqiponja-lana'));const earned=p.merit;
  p=beginPoliceMission(p,'shqiponja-school');p.active=null;p.merit=999999;
  assert.equal(normalizePoliceProfile(p).merit,earned);assert.equal(normalizePoliceProfile({version:1,completed:['renea-protection']}).merit,0);
});
