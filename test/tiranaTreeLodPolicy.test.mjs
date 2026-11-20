import test from 'node:test';
import assert from 'node:assert/strict';
import {useMediumTree,importedTreeBudget} from '../webapp/src/games/tirana-street-life/treeLodPolicy.mjs';
test('10m hysteresis holds both directions and battery uses closer threshold',()=>{
 for(const battery of [false,true]){
  const outer=battery?35:55,inner=outer-10;
  assert.equal(useMediumTree(outer,false,battery),false);
  assert.equal(useMediumTree(outer+.01,false,battery),true);
  for(let d=inner+.01;d<outer;d++){
   assert.equal(useMediumTree(d,true,battery),true);
   assert.equal(useMediumTree(d,false,battery),false);
  }
  assert.equal(useMediumTree(inner,true,battery),false);
 }
 assert.equal(useMediumTree(NaN),false);
});
test('combined imported tree budget remains8high and3battery',()=>{
 assert.equal(importedTreeBudget(false),8);assert.equal(importedTreeBudget(true),3);
});
