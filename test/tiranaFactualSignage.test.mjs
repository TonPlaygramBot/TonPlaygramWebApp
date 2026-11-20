import test from 'node:test';
import assert from 'node:assert/strict';
import {referencedAdvertising,signReferenceFor} from '../webapp/src/games/tirana-street-life/signReferences.mjs';
import {BUSINESS_SIGNS} from '../webapp/src/games/tirana-city-source/businessSignRegistry.mjs';

test('authored roadside panels never imply nearby tenant advertising',()=>{
 const site={id:'authored',x:1,z:2,yaw:0.5,name:'Old commercial text',width:4};
 for(const shops of [[],[{x:1,z:2,name:'Mulliri'}],[{x:1,z:2,name:'Spar'}]]){
  const panel=referencedAdvertising(site,shops);
  assert.equal(panel.name,'TIRANË');assert.equal(signReferenceFor(panel.name),undefined);
  assert.equal(panel.x,site.x);assert.equal(panel.z,site.z);assert.equal(panel.yaw,site.yaw);
  assert.match(panel.placementAccuracy,/not a surveyed advertisement/);
 }
 assert.equal(site.name,'Old commercial text');
});
test('Toptani retains factual fascia on existing mapped building, without copied logo',()=>{
 const signs=BUSINESS_SIGNS.filter(s=>s.name==='Toptani');
 assert.equal(signs.length,1);assert.equal(signs[0].buildingId,'177186612');
 assert.match(signs[0].source,/toptani\.com\.al/);
 assert.equal(signReferenceFor('Toptani'),undefined);
});
test('mapped unrelated storefront identities are not removed',()=>{
 assert.equal(signReferenceFor('Mulliri')?.id,'mulliri');
 assert.ok(BUSINESS_SIGNS.some(s=>/Tirana International/.test(s.name)));
});
