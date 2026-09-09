import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as legacy from '../webapp/src/games/kartroyale/legacySimulation.mjs';
import {TRACKS,CUPS,makeTrack,createRacer,stepRace,STEP,RACE_LIMIT,GRAND_ROUTE_DIAGNOSTICS} from '../webapp/src/games/kartroyale/simulation.mjs';

// These tests run the actual checked-in kart physics and street paths. No
// simulated results, teleports, simplified steering or mocked collisions.
test('five original tracks, cup indices and their physics exports are preserved',()=>{
  assert.equal(GRAND_ROUTE_DIAGNOSTICS.length,0);
  assert.equal(TRACKS.length,6);
  for(const c of legacy.TRACKS)assert.equal(makeTrack(c.id),legacy.makeTrack(c.id));
  for(let i=0;i<legacy.CUPS.length;i++)assert.equal(CUPS[i],legacy.CUPS[i]);
  assert.equal(createRacer,legacy.createRacer);assert.equal(stepRace,legacy.stepRace);
});
for(const difficulty of ['rookie','street','pro'])for(const config of TRACKS){
  test(`${config.id}: six ${difficulty} AI karts finish the real race within the unchanged limit`,()=>{
    const t=makeTrack(config.id),racers=Array.from({length:6},(_,i)=>createRacer(t,`test-${i}`,`AI ${i}`,i,true));
    for(let tick=1;tick<=RACE_LIMIT/STEP&&!racers.every(r=>r.finished||r.retired);tick++)stepRace(racers,t,STEP,tick*STEP,difficulty);
    for(const r of racers){
      assert.ok([r.x,r.z,r.yaw,r.health,r.finishTime].every(Number.isFinite));
      assert.ok(r.finished&&!r.retired,`${config.id}/${difficulty}/${r.slot}: lap ${r.lap}, health ${r.health}, index ${r.index}`);
      assert.ok(r.finishTime>0&&r.finishTime<=RACE_LIMIT);
    }
  });
}
test('verified baseline route and original physics files remain byte-identical',()=>{
  const expected={
    'legacySimulation.mjs':'dff29c999eff5b130cbc0150358539f9ff9dd615',
    'collisions.mjs':'24f90ef8d8e7fa1e9109c5d5ee9c7da89a20f687',
    'tirana-routes.mjs':'69529cb43abe8754fcf347d6293bbc07911db94c'
  };
  for(const [name,sha] of Object.entries(expected)){
    const b=readFileSync(new URL(`../webapp/src/games/kartroyale/${name}`,import.meta.url));
    assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),sha,name);
  }
});
