// Full-checkout tests. Not replaced with a synthetic WORLD when sources are absent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {STREET_DETAILS,detailPostObstacles} from '../webapp/src/games/tirana-street-detail/sharedRoadDetails.mjs';
import {ribbonExclusion,segmentDistance} from '../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
import {OBSTACLES,ORIGIN} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('original source WORLD is unchanged, not replaced by invented lane geometry',()=>{
 const b=readFileSync(new URL('../webapp/src/games/tiranastreets/shared/world.mjs',import.meta.url));
 assert.equal(createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'),'69157413d6ebc8eeb2c822436dde2761e793b6b7');
 assert.ok(STREET_DETAILS.decals.some(p=>p.kind==='bicycle'),'Real stored city must produce a visible cycle section');
 assert.ok(STREET_DETAILS.posts.length>0,'Real stored city must produce pedestrian posts');
});
test('all actual-city posts clear mapped carriageways and have FPS collision',()=>{
 const boxes=detailPostObstacles(ORIGIN);assert.equal(boxes.length,STREET_DETAILS.posts.length);
 for(let i=0;i<boxes.length;i++){
  const p=STREET_DETAILS.posts[i],b=boxes[i];
  assert.ok(OBSTACLES.some(o=>Math.abs(o.x-b.x)<1e-8&&Math.abs(o.z-b.z)<1e-8&&o.w===b.w&&o.d===b.d&&o.minY===.23));
  for(const road of WORLD.roads)assert.ok(segmentDistance(p.x,p.z,road.a,road.b)>=road.w/2+.249999,'Post on carriageway or footpath');
 }
});
test('every Racing Royal circuit has a closed ribbon exclusion without changing its points',()=>{
 for(const config of TRACKS){const track=makeTrack(config.id),before=JSON.stringify(track.points),exclude=ribbonExclusion(track);
  assert.ok(track.points.every(p=>exclude(p.x,p.z,1)));
  const retained=STREET_DETAILS.posts.filter(p=>!exclude(p.x,p.z,1));
  assert.ok(retained.length<=STREET_DETAILS.posts.length);assert.equal(JSON.stringify(track.points),before);
 }
});
test('actual lobby and both active scene adapters use the new integrations',()=>{
 assert.match(read('webapp/src/pages/Games/TiranaStreetsLobby.jsx'),/localActivityURL\(item.id\)/);
 assert.match(read('webapp/src/games/blackwater/ui.tsx'),/activity==='street-career'/);
 assert.match(read('webapp/src/games/blackwater/cityWorld.ts'),/enhancements.bindBuildings\(city.group/);
 assert.match(read('webapp/src/games/tiranastreets/street-career/StreetRenderer.ts'),/details.bindBuildings\(this.scene/);
 assert.match(read('webapp/src/games/kartroyale/tiranaScenery.ts'),/profile:'racing',track/);
 assert.match(read('webapp/src/games/tiranastreets/street-career/SharedGameCast.ts'),/CHESS_HUMAN_CHARACTER_OPTIONS/);
 const catalog=read('webapp/src/config/chessBattleInventoryConfig.js');
 for(const id of ['rpm-current','rpm-67d411-domino','rpm-67f433-domino','rpm-67e1b5-domino'])assert.ok(catalog.includes(id));
});
