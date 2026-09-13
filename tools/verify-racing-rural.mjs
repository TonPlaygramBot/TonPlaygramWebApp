import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {STEP,makeTrack,createRacer,equipKart,stepRace} from '../webapp/src/games/kartroyale/simulation.mjs';
import {RURAL_ROUTES} from '../webapp/src/games/kartroyale/rural-routes.mjs';
import {jumpRamps} from '../webapp/src/games/kartroyale/jumpRamps.mjs';
const results=[];
for(const {id} of RURAL_ROUTES)for(const difficulty of ['rookie','street','pro']){
  const track=makeTrack(id),racers=Array.from({length:6},(_,i)=>equipKart(createRacer(track,''+i,'AI',i,true),['apex','oobi','oodi','ooli','oopi','photon'][i]));
  let time=0,jumps=0,walls=0;
  for(;time<1000&&!racers.every(r=>r.finished);time+=STEP){
    const airborne=racers.map(r=>r.airborne);stepRace(racers,track,STEP,time,difficulty);
    racers.forEach((r,i)=>{if(r.airborne&&!airborne[i])jumps++;walls+=r.wallContact?1:0;assert.ok([r.x,r.z,r.speed,r.groundY,r.jumpHeight].every(Number.isFinite),id);});
  }
  const result={id,difficulty,length:Math.round(track.length),ramps:jumpRamps(track).length,finished:racers.filter(r=>r.finished&&r.gates===13).length,seconds:+time.toFixed(2),jumps,wallFrames:walls};
  console.log(JSON.stringify(result));results.push(result);assert.equal(result.finished,6,id+' '+difficulty);
}
const dir=new URL('../docs/validation/racing-rural/',import.meta.url);await mkdir(dir,{recursive:true});await writeFile(new URL('races.json',dir),JSON.stringify(results,null,2)+'\n');
