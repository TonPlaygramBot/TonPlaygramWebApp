import test from 'node:test';
import assert from 'node:assert/strict';
import {VERIFIED_TREE_METADATA,VERIFIED_RAIL_PIECES,FIXTURE_SOURCES} from '../webapp/src/games/tiranastreets-november/shared/verifiedStreetDecorData.mjs';
import {withVerifiedTreeMetadata} from '../webapp/src/games/tiranastreets-november/shared/verifiedStreetDecor.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {CITY_COMPLETION} from '../webapp/src/games/tirana-city-completion/data.mjs';
import {RAILINGS} from '../webapp/src/games/tiranastreets/shared/landscape.mjs';
import {onCarriageway,segmentDistance} from '../webapp/src/games/tiranastreets-november/shared/streetLayout.mjs';
import {groundHeight} from '../webapp/src/games/tirana-east/terrainCore.mjs';

test('OSM tree metadata applies to the same preexisting node, never spawning or moving trees',()=>{
 const trees=[...CANOPY_TREES,...CITY_COMPLETION.trees];const sources=new Map(VERIFIED_TREE_METADATA.map(t=>[t.id,t]));
 let mapped=0,shape=0,height=0;
 assert.equal(sources.size,VERIFIED_TREE_METADATA.length);
 for(const t of trees){
  const v=withVerifiedTreeMetadata(t);
  if(t===v)continue;
  mapped++;const s=sources.get(t.id);
  assert.deepEqual([v.id,v.x,v.z],[t.id,t.x,t.z]);
  assert.deepEqual(v.mapTags,s.tags);
  if(s.shape){assert.equal(v.shape,s.shape);shape++;}
  if(s.height){assert.equal(v.height,s.height);height++;}
 }
 assert.ok(mapped>=650);
 assert.ok(shape>=75);
 assert.ok(height>=5);
 const t=trees.find(t=>sources.has(t.id)&&withVerifiedTreeMetadata(t)!==t);
 const wrongPosition={...t,x:t.x+.5};assert.equal(withVerifiedTreeMetadata(wrongPosition),wrongPosition);
});
test('ground-level source railings are clear of roads and pedestrian routes and do not duplicate legacy rails',()=>{
 assert.ok(new Set(VERIFIED_RAIL_PIECES.map(r=>r.id)).size>=15);
 const footways=WORLD.roads.filter(r=>r.walk);
 for(const rail of VERIFIED_RAIL_PIECES){
  assert.equal(rail.tags.barrier,'guard_rail');
  assert.ok(rail.length>=.3&&rail.length<=2.6001);
  assert.equal(groundHeight(rail.x,rail.z),0);
  assert.ok(RAILINGS.every(r=>segmentDistance(rail.x,rail.z,r.a,r.b)>=.8));
  for(const [x,z] of [rail.a,[rail.x,rail.z],rail.b]){
   assert.equal(onCarriageway(x,z,.75),false);
   assert.ok(footways.every(r=>segmentDistance(x,z,r.a,r.b)>=r.w/2+.4));
  }
 }
 const archive=FIXTURE_SOURCES.find(a=>a.file==='tirana-urban-source.osm.json.gz');
 assert.equal(archive.sha256,'dca70c5d585b90c6c042b033bb4bfb001da8b297d7767b2cd927bb1875611602');
});
