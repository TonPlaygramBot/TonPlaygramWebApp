import test from 'node:test';
import assert from 'node:assert/strict';
import {VERIFIED_STOREFRONT_BOARDS,STOREFRONT_BOARD_REACH,storefrontBoard} from '../webapp/src/games/tirana-street-life/verifiedStorefrontBoards.mjs';
import {STREET_LIFE} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import {pointInUrbanBounds} from '../webapp/src/games/tiranastreets/shared/urbanBounds.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {ribbonExclusion} from '../webapp/src/games/tirana-street-detail/roadDetailCore.mjs';
const stores=[...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts];
test('every reviewed sign is mounted once, on a mapped tenant and supported building in the existing city',()=>{
 assert.equal(VERIFIED_STOREFRONT_BOARDS.length,10);
 for(const board of VERIFIED_STOREFRONT_BOARDS){
  const eligible=stores.filter(s=>s.id===board.id&&storefrontBoard(s));
  assert.equal(eligible.length,1,board.id);
  const [site]=eligible;
  assert.ok(pointInUrbanBounds(site,4),board.id);
  assert.ok(WORLD.buildings.some(x=>String(x.id)===board.buildingId),board.id);
  assert.ok(board.source.startsWith('https://'));
  // The parent renderer uses this same road-ribbon exclusion for the whole facade.
  assert.equal(ribbonExclusion({points:[[site.x-20,site.z],[site.x+20,site.z]],width:6})(site.x,site.z,4),true);
 }
});
test('two orthogonal readable faces and supporting geometry stay overhead and inside the existing culling radius',()=>{
 for(const source of VERIFIED_STOREFRONT_BOARDS){
  const site=stores.find(s=>s.id===source.id&&storefrontBoard(s));
  const b=storefrontBoard(site);
  assert.equal(b.parts.length,3);
  assert.equal(b.signs.length,2);
  assert.equal(b.signs[1].yaw-b.signs[0].yaw,Math.PI);
  for(const s of b.signs){
   assert.equal(s.text,source.name);assert.ok(s.caption);assert.equal(s.plain,true);
   assert.ok(s.p[1]-s.s[1]/2>3.4);
   assert.ok(s.p[2]+s.s[0]/2<=STOREFRONT_BOARD_REACH);
   assert.ok(Math.hypot(s.p[0],s.p[2]+s.s[0]/2)<4);
  }
 }
});
test('an unrelated or changed business never inherits the reviewed sign artwork',()=>{
 const source=VERIFIED_STOREFRONT_BOARDS[0];
 const site=stores.find(s=>s.id===source.id);
 assert.equal(storefrontBoard({...site,id:'new'}),null);
 assert.equal(storefrontBoard({...site,buildingId:'new'}),null);
 assert.equal(storefrontBoard({...site,name:'New tenant'}),null);
 assert.equal(storefrontBoard({...site,width:2}),null);
});
