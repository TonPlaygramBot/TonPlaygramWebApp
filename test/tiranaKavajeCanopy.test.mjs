import test from 'node:test';
import assert from 'node:assert/strict';
import {withKavajeCanopy} from '../webapp/src/games/tirana-street-life/kavajeCanopy.mjs';
import {CITY_COMPLETION} from '../webapp/src/games/tirana-city-completion/data.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {clearStreetPoint} from '../webapp/src/games/tiranastreets/shared/streetSafety.mjs';
test('Kavaja photographs refine canopy styles without modifying any trunk location',()=>{
 const trees=[...CITY_COMPLETION.trees,...CANOPY_TREES];
 let count=0,west=0;
 for(const source of trees){
  const t=withKavajeCanopy(source);
  if(t===source)continue;
  count++;if(t.x< -900)west++;
  assert.match(t.id,/^node\/\d+$/);
  assert.equal(t.shape,'garden');
  for(const k of ['id','x','z','height','crown','seed','zone'])assert.equal(t[k],source[k]);
  assert.ok(clearStreetPoint(t,.45));
  assert.equal(withKavajeCanopy({...source,shape:'column'}).shape,'column');
  assert.equal(withKavajeCanopy({...source,id:'generated/unknown'}).shape,'upright');
 }
 assert.ok(count>100&&west>40);
 console.log({mappedTrunksWithSpreadingCanopies:count,westernTrunks:west});
});
