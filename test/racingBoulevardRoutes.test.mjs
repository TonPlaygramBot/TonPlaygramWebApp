import test from 'node:test';
import assert from 'node:assert/strict';
import {MAIN_ROAD_ROUTES} from '../webapp/src/games/kartroyale/main-road-routes.mjs';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {makeTrack,createRacer,nearestPoint} from '../webapp/src/games/kartroyale/simulation.mjs';
import {sampleCircuitDistance} from '../webapp/src/games/kartroyale/circuitMetrics.mjs';

const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
const roads=new Map(WORLD.roads.map(r=>[key(r.a,r.b),r]));

test('remade district circuits spend most of their length on genuine broad carriageways',()=>{
  const signatures=new Set();
  for(const route of MAIN_ROAD_ROUTES){
    let length=0,broad=0,weightedWidth=0,minimum=Infinity;
    route.points.forEach((p,i)=>{
      const q=route.points[(i+1)%route.points.length],road=roads.get(key(p,q));
      assert.ok(road&&!road.walk&&road.w>=6.2,route.id+' unavailable road');
      const distance=Math.hypot(q[0]-p[0],q[1]-p[1]);length+=distance;
      broad+=road.w>=9?distance:0;weightedWidth+=road.w*distance;minimum=Math.min(minimum,road.w);
    });
    assert.ok(broad/length>=.75,route.id+' insufficient overtaking roads');
    assert.ok(Math.abs(broad/length-route.routeStats.broadRoadShare)<.0001);
    assert.ok(Math.abs(weightedWidth/length-route.routeStats.averageSourceWidth)<.01);
    assert.equal(minimum,route.routeStats.minimumSourceWidth);
    assert.ok(length>=1600&&length<=4200);
    const signature=route.points.map(p=>p.join(',')).sort().join('|');
    assert.ok(!signatures.has(signature),'each district keeps a distinct route');signatures.add(signature);
  }
});

test('the full grid starts on a wide straight with space ahead before the first turn',()=>{
  for(const route of MAIN_ROAD_ROUTES){
    const track=makeTrack(route.id),yaw=track.points[0].yaw;
    assert.ok(track.startGrid.minimumWidth>=8,route.id+' narrow grid approach');
    assert.ok(track.startGrid.turn<.15,route.id+' grid on a sharp corner');
    for(let metres=-72;metres<=90;metres+=3){
      const p=sampleCircuitDistance(track,metres),q=track.points[p.index];
      assert.ok(q.width>=8,route.id+' squeezes grid onto narrow road');
      assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw-yaw),Math.cos(p.yaw-yaw)))<.15,route.id+' first turn too close');
    }
    const racers=Array.from({length:12},(_,i)=>createRacer(track,'grid-'+i,'Driver',i,true));
    for(const racer of racers){
      const near=nearestPoint(track,racer.x,racer.z,racer.index);
      assert.ok(near.distance+racer.bodyWidth/2<near.width/2,route.id+' grid touches road boundary');
      for(const other of racers)if(other!==racer)assert.ok(Math.hypot(racer.x-other.x,racer.z-other.z)>2,route.id+' overlapping grid');
    }
  }
});
