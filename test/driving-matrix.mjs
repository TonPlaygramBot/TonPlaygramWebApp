// Real checked-in simulation/collisions. No renderer, mocked steering, or teleporting.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const root=process.env.UPGRADE_ROOT||path.resolve(import.meta.dirname,'..');
const load=f=>import(pathToFileURL(path.join(root,'webapp/src/games/kartroyale',f)));
const sim=await load('legacySimulation.mjs');
const {buildRaceCatalog}=await load('raceCatalog.mjs');
const {TIRANA_ROUTES}=await load('tirana-routes.mjs');
const catalog=buildRaceCatalog(sim,TIRANA_ROUTES),results=[];
for(const config of catalog.tracks)for(const difficulty of ['rookie','street','pro']){
 const track=catalog.makeTrack(config.id),racers=Array.from({length:6},(_,i)=>sim.createRacer(track,`${i}`,`AI ${i}`,i,true));
 let ticks=0,contacts=0;
 while(ticks<sim.RACE_LIMIT/sim.STEP&&!racers.every(r=>r.finished||r.retired)){
  ticks++;sim.stepRace(racers,track,sim.STEP,ticks*sim.STEP,difficulty);
  for(const r of racers){if(![r.x,r.z,r.speed,r.health,r.progress].every(Number.isFinite))throw Error('Non-finite racer');if(r.wallContact&&!r.finished&&!r.retired)contacts++;}
 }
 const result={track:config.id,difficulty,lengthMeters:track.length,finished:racers.filter(r=>r.finished).length,retired:racers.filter(r=>r.retired).length,timedOut:racers.filter(r=>!r.finished&&!r.retired).length,wallContactFrames:contacts,meanFinish:racers.reduce((s,r)=>s+r.finishTime,0)/6,minHealth:Math.min(...racers.map(r=>r.health))};
 results.push(result);console.log(JSON.stringify(result));
}
if(process.env.RESULT_JSON)writeFileSync(process.env.RESULT_JSON,JSON.stringify({sourceRoot:root,step:sim.STEP,lapCount:sim.LAPS,limitSeconds:sim.RACE_LIMIT,results},null,2)+'\n');
const failures=results.filter(r=>r.finished!==6);console.log(`RACES=${results.length} FINISHES=${results.reduce((s,r)=>s+r.finished,0)} FAILING_RACES=${failures.length}`);if(failures.length)process.exitCode=1;
