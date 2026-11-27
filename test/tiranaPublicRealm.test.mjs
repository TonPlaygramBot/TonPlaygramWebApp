import test from 'node:test';
import assert from 'node:assert/strict';
import {publicRealmSeatingZone as zone,curateMappedBenches,keepSquareTree}
 from '../webapp/src/games/tirana-environment/publicRealmCore.mjs';

test('public realm zone follows the Lana alignment without affecting distant blocks',()=>{
 const line=[[50,400],[0,413],[-500,531]];
 assert.equal(zone(0,0,line),'square');
 assert.equal(zone(28,426,line),'lana');
 assert.equal(zone(0,470,line),null);
 assert.equal(zone(-400,519,line),'lana');
 assert.equal(zone(-560,530,line),null);
 assert.equal(zone(600,50,line),null);
});
test('square and river thin clustered seating, not seats in other neighborhoods',()=>{
 const clusters=[{x:1,z:2},{x:2,z:3},{x:14,z:2},{x:1,z:400},{x:8,z:400},{x:32,z:400},{x:630,z:52},{x:631,z:52}];
 assert.deepEqual(curateMappedBenches(clusters,[[0,400],[100,400]]),
   [clusters[0],clusters[2],clusters[3],clusters[5],clusters[6],clusters[7]]);
});
test('square removes synthetic crowding, not mapped trunks or other garden canopy',()=>{
 assert.equal(keepSquareTree({id:'canopy/way/624093777/1/1',zone:'estimated-area-canopy'}),false);
 assert.equal(keepSquareTree({id:'canopy/way/624093804/0/0',zone:'estimated-area-canopy'}),false);
 assert.equal(keepSquareTree({id:'node/5893074396',zone:'square-gardens'}),true);
 assert.equal(keepSquareTree({id:'canopy/way/1524779369/2/1',zone:'estimated-area-canopy'}),true);
});

test('shipped city map retains other neighborhoods and every mapped tree',async()=>{
 const [{NEIGHBOURHOOD},{CANOPY_TREES},{CITY_COMPLETION},{RIVER_PATHS}]=await Promise.all([
  import('../webapp/src/games/tirana-neighbourhood/data.mjs'),
  import('../webapp/src/games/tirana-street-life/canopyRegistry.mjs'),
  import('../webapp/src/games/tirana-city-completion/data.mjs'),
  import('../webapp/src/games/tiranastreets/shared/landscape.mjs')
 ]);
 const line=RIVER_PATHS[0].line;
 const benches=NEIGHBOURHOOD.places.filter(p=>p.point&&p.tags.amenity==='bench')
   .map(p=>({id:p.id,x:p.point[0],z:p.point[1]}));
 const kept=curateMappedBenches(benches,line);
 for(const area of ['square','lana']){
  const before=benches.filter(p=>zone(p.x,p.z,line)===area);
  const after=kept.filter(p=>zone(p.x,p.z,line)===area);
  assert.ok(after.length>0 && after.length<before.length,area);
 }
 assert.deepEqual(kept.filter(p=>!zone(p.x,p.z,line)),benches.filter(p=>!zone(p.x,p.z,line)));
 const excluded=[...CANOPY_TREES,...CITY_COMPLETION.trees].filter(p=>!keepSquareTree(p));
 assert.equal(excluded.length,14);
 assert.ok(excluded.every(p=>p.zone==='estimated-area-canopy'&&p.id.startsWith('canopy/way/')));
});
