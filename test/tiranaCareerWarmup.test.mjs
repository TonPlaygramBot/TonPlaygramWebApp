import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canWarmCareer,createSharedCareerLoad} from '../webapp/src/games/blackwater-november/careerWarmupPolicy.mjs';
test('only warm on visible capable links; save-data and unsupported connection are left alone',()=>{
 assert.equal(canWarmCareer({effectiveType:'4g'},'visible'),true);
 for(const connection of [undefined,{effectiveType:'2g'},{effectiveType:'slow-2g'},{effectiveType:'3g'},{effectiveType:'4g',saveData:true}]){
  assert.equal(canWarmCareer(connection,'visible'),false);
 }
 assert.equal(canWarmCareer({effectiveType:'4g'},'hidden'),false);
});
test('warm and actual play join exactly one import',async()=>{
 let n=0,finish;
 const load=createSharedCareerLoad(()=>{n++;return new Promise(resolve=>{finish=resolve;});});
 const warm=load(),play=load();
 assert.equal(warm,play);
 await Promise.resolve();
 assert.equal(n,1);
 finish('career');assert.equal(await play,'career');
 assert.equal(await load(),'career');assert.equal(n,1);
});
test('a failed prewarm is not cached against play',async()=>{
 let n=0;
 const load=createSharedCareerLoad(async()=>{if(++n===1)throw Error('offline');return 'career';});
 await assert.rejects(load(),/offline/);
 assert.equal(await load(),'career');assert.equal(n,2);
});
