import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { URBAN_RACE_ROUTES } from '../webapp/src/games/kartroyale/urban-race-routes.mjs';
import { STEP, makeTrack, createRacer, stepRace } from '../webapp/src/games/kartroyale/simulation.mjs';
const id='tirana-sulejman-delvina', way=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
const route=URBAN_RACE_ROUTES.find(r=>r.id===id), track=makeTrack(id);

test('Lana corridor retains its save id and closes exclusively over drivable source edges',()=>{
 const edges=new Map(WORLD.roads.filter(r=>!r.walk).map(r=>[way(r.a,r.b),r]));
 const points=route.points;
 assert.equal(new Set(points.map(p=>p.join(','))).size,points.length);
 let broad=0, total=0;
 for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],edge=edges.get(way(a,b));
   assert.ok(edge,`disconnected segment ${i}`);
   const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   assert.ok(edge.w>=6.2 && length>0);
   total+=length;
   if(edge.w>=9)broad+=length;
 }
 assert.ok(total>2150 && total<2200);
 assert.ok(broad/total>.63);
 assert.ok(route.streets.includes('Bulevardi Gjergj Fishta'));
 assert.ok(route.streets.includes('Bulevardi Bajram Curri'));
 assert.equal(URBAN_RACE_ROUTES.length,20);
 assert.ok(track.startGrid.minimumWidth>=9);
 assert.ok(track.startGrid.turn<.01);
 assert.ok(track.passingAudit.minimumWidth>=5.8);
 assert.deepEqual(track.passingAudit.unresolved,[]);
});

test('four opponents finish all three laps at each AI difficulty using the fixed-step race',()=>{
 let previous=Infinity;
 for(const difficulty of ['rookie','street','pro']){
   const racers=Array.from({length:4},(_,slot)=>createRacer(track,`fixture-${slot}`,'Fixture',slot,true));
   for(let time=STEP;time<275&&!racers.every(r=>r.finished);time+=STEP)
     stepRace(racers,track,STEP,time,difficulty);
   for(const racer of racers) {
     assert.equal(racer.finished,true,difficulty);
     assert.equal(racer.telemetry.completed,3,difficulty);
     assert.equal(racer.gates,13,difficulty);
     assert.ok(racer.telemetry.bestLap>0,difficulty);
   }
   const mean=racers.reduce((a,r)=>a+r.finishTime,0)/racers.length;
   assert.ok(mean<previous,`${difficulty} group did not improve over previous difficulty`);
   previous=mean;
 }
});
