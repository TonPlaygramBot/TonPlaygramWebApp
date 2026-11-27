import assert from 'node:assert/strict';
import test from 'node:test';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {WORLD as SOLO} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {footprintDistance, polygonContains} from '../webapp/src/games/tiranastreets/shared/architecture.mjs';
import {segmentDistance} from '../webapp/src/games/tiranastreets/shared/streetLayout.mjs';
import {MAPPED_PARKS} from '../webapp/src/games/tirana-environment/mappedAmenitiesCore.mjs';
import {bridgeRibOffsets, downtownPlayPoint, DOWNTOWN_PLAYGROUND, etcRoofText, ETC_BUILDING, findEtcWalkBridge, PLAY_RADIUS}
 from '../webapp/src/games/tirana-environment/etcCorridor.mjs';

test('only the same mapped Lana walking deck in both games gets red ribs', () => {
 const road = findEtcWalkBridge(WORLD.roads);
 assert.ok(road);
 assert.deepEqual(findEtcWalkBridge(SOLO.roads),road);
 assert.equal(findEtcWalkBridge([{...road,walk:false}]),undefined);
 assert.equal(findEtcWalkBridge([{...road,a:[road.a[0]+1,road.a[1]]}]),undefined);
 assert.ok(findEtcWalkBridge([{...road,a:road.b,b:road.a}]));
 const ribs = bridgeRibOffsets(road,()=>false);
 assert.equal(ribs.length,6);
 assert.equal(ribs[0],-ribs.at(-1));
 assert.equal(bridgeRibOffsets(road,(_x,z)=>z<356).length,5);
 assert.deepEqual(bridgeRibOffsets(road,()=>true),[]);
});

test('ETC roof text mounts wholly within the intended building, not Elkos ETC', () => {
 assert.deepEqual(etcRoofText(WORLD.buildings),etcRoofText(SOLO.buildings));
 const sign = etcRoofText(WORLD.buildings);
 assert.ok(sign);
 const b = WORLD.buildings.find(b=>b.id===ETC_BUILDING);
 assert.equal(sign.roof,b.h);
 for(const across of [-2.10,2.10]) for(const forward of [-.26,.26]){
  const x=sign.x+across*Math.cos(sign.yaw)+forward*Math.sin(sign.yaw);
  const z=sign.z-across*Math.sin(sign.yaw)+forward*Math.cos(sign.yaw);
  assert.ok(polygonContains(x,z,b.p));
 }
 assert.equal(etcRoofText(WORLD.buildings.filter(b=>b.id!==ETC_BUILDING)),undefined);
});

test('one compact play pad uses the mapped point by Downtown One with path and building clearance', () => {
 const play = downtownPlayPoint(MAPPED_PARKS,WORLD.buildings, (x,z,r) => {
  assert.equal(r,PLAY_RADIUS);
  return !WORLD.roads.some(road => segmentDistance(x,z,road.a,road.b)<road.w/2+r) &&
   !WORLD.buildings.some(b=>footprintDistance(x,z,b.p)<r);
 });
 assert.equal(play?.id,DOWNTOWN_PLAYGROUND);
 assert.ok(!play.ring,'point is not a surveyed polygon');
 assert.equal(downtownPlayPoint(MAPPED_PARKS,WORLD.buildings,()=>false),undefined);
 assert.equal(downtownPlayPoint(MAPPED_PARKS,[],()=>true),undefined);
});
