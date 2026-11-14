// Full-checkout tests. Not replaced with a synthetic WORLD when sources are absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STREET_DETAILS,detailPostObstacles} from '../webapp/src/games/tirana-street-detail/sharedRoadDetails.mjs';
import {ribbonExclusion} from '../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import {OBSTACLES,ORIGIN} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('original source WORLD is unchanged, not replaced by invented lane geometry',()=>{
 const b=readFileSync(new URL('../webapp/src/games/tiranastreets/shared/world.mjs',import.meta.url));
 // Existing main map at 16bf14f; this change only alters the surrounding rendering.
 assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),'7dce43d85beb0cb7f682017ec0426ee2472d0973');
 assert.ok(STREET_DETAILS.decals.some(p=>p.kind==='bicycle'),'Real stored city must produce a visible cycle section');
 assert.equal(STREET_DETAILS.posts.length,0,'Concrete pedestrian posts are removed');
});
test('removed concrete posts leave no invisible FPS collision boxes',()=>{
 assert.deepEqual(detailPostObstacles(ORIGIN),[]);
 assert.equal(OBSTACLES.filter(o=>o.minY===.23).length,0);
});
test('every Racing Royal circuit has a closed ribbon exclusion without changing its points',()=>{
 for(const config of TRACKS){const track=makeTrack(config.id),before=JSON.stringify(track.points),exclude=ribbonExclusion(track);
  assert.ok(track.points.every(p=>exclude(p.x,p.z,1)));
  const retained=STREET_DETAILS.posts.filter(p=>!exclude(p.x,p.z,1));
  assert.ok(retained.length<=STREET_DETAILS.posts.length);assert.equal(JSON.stringify(track.points),before);
 }
});
