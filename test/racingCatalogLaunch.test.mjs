import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
import {WORLD as CITY} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {FREE_ROAM_STARTS} from '../webapp/src/games/kartroyale/freeRoam.mjs';
import {buildRaceCatalog} from '../webapp/src/games/kartroyale/raceCatalog.mjs';

test('all selectable city tracks construct against the unchanged city snapshot',()=>{
 assert.equal(TRACKS.length,20);
 for(const config of TRACKS){
  const track=makeTrack(config.id);assert.equal(track.id,config.id);
  assert.ok(track.length>0&&track.points.length>=360);
  assert.ok(track.points.every(p=>[p.x,p.z,p.width].every(Number.isFinite)));
  assert.equal(makeTrack(config.id),track,'reuse the prepared circuit');
 }
});
test('racing uses the exact city world without loading retired rural supplements',()=>{
 assert.equal(WORLD,CITY);
 assert.deepEqual(CITY.bounds,[-5000,-3500,3600,3100]);
 assert.ok(FREE_ROAM_STARTS.every(s=>!['farke','surrel','liqeni'].includes(s.track)));
});
test('a genuinely unsourced circuit still fails validation instead of receiving an invented width',()=>{
 const legacy={TRACKS:[{id:'bad'}],CUPS:[]};
 assert.throws(()=>buildRaceCatalog(legacy,[{id:'bad',points:[[99999,99999],[99999,99990],[99990,99999]]}]),/street network \(bad, segment 0\)/);
});
