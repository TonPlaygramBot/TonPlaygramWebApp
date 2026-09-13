import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { TRACKS, STEP, makeTrack, createRacer, equipKart, stepRace } from '../webapp/src/games/kartroyale/simulation.mjs';
import { roadBumps } from '../webapp/src/games/kartroyale/roadFeel.mjs';

const results=[];
const configs=process.argv[3]?TRACKS.filter(t=>t.id===process.argv[3]):TRACKS;
assert.ok(configs.length,'choose a listed track');
for(const config of configs)for(const difficulty of ['rookie','street','pro']){
  const track=makeTrack(config.id),racers=Array.from({length:6},(_,i)=>equipKart(createRacer(track,String(i),'Rival',i,true),'apex'));
  let time=0,walls=0,driftFrames=0,boostFrames=0;
  for(;time<1000&&!racers.every(r=>r.finished);time+=STEP){
    stepRace(racers,track,STEP,time,difficulty);
    for(const r of racers){
      if(!r.finished&&r.wallContact)walls++;
      if(r.drifting)driftFrames++;
      if(r.boosting)boostFrames++;
      assert.ok([r.x,r.z,r.speed,r.suspension.height,r.suspension.grip].every(Number.isFinite));
    }
  }
  const result={track:config.id,difficulty,length:Math.round(track.length),bumps:roadBumps(track).length,
    finished:racers.filter(r=>r.finished&&r.gates===13).length,
    meanFinish:racers.reduce((a,r)=>a+r.finishTime,0)/racers.length,walls,driftFrames,boostFrames};
  console.log(JSON.stringify(result));results.push(result);
  assert.equal(result.finished,6,config.id+' '+difficulty+' all racers must finish');
}
for(const config of configs){
  const rows=results.filter(r=>r.track===config.id);
  assert.ok(rows[2].meanFinish<rows[1].meanFinish&&rows[1].meanFinish<rows[0].meanFinish,config.id+' difficulty must change racing pace');
}
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(results,null,2)+'\n');
