import test from 'node:test';
import assert from 'node:assert/strict';
import {QUARTER} from '../webapp/src/games/tirana-tabakeve/quarterData.mjs';
import {BRIDGE,bridgeDeckHeight,tabakeveBridgeHeight,quarterFacadeParts,generateQuarterTrees} from '../webapp/src/games/tirana-tabakeve/quarterCore.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {clearStreetPoint} from '../webapp/src/games/tiranastreets/shared/streetSafety.mjs';
import {inside,spatialIndex,bounds} from '../webapp/src/games/tirana-city-completion/placementCore.mjs';
import {facadeEdges,segmentDistance} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import {HYDROGRAPHY} from '../webapp/src/games/tirana-environment/hydrography.mjs';
import {riverRing} from '../webapp/src/games/tirana-environment/riverShapeCore.mjs';
const byId=new Map(WORLD.buildings.map(b=>[b.id,b]));

test('quarter improves retained building outlines and schools without adding duplicate shells',()=>{
 assert.ok(QUARTER.buildings.length>=200);assert.equal(new Set(QUARTER.buildings.map(b=>b.id)).size,QUARTER.buildings.length);
 for(const b of QUARTER.buildings){const source=byId.get(b.id);assert.ok(source,b.id);assert.equal(b.h,source.h);
  for(const e of b.edges)assert.ok(facadeEdges(source.p).some(s=>s.a[0]===e.a[0]&&s.a[1]===e.a[1]&&s.b[0]===e.b[0]&&s.b[1]===e.b[1]),b.id);
  if(b.roof)assert.ok(inside(b.roof.x,b.roof.z,source.p,source.holes||[]),`Roof tank inside ${b.id}`);
  for(const p of quarterFacadeParts(b)){for(const key of ['x','y','z','w','h','d','yaw'])assert.ok(Number.isFinite(p[key]),`${b.id}:${key}`);assert.ok(p.w>0&&p.h>0&&p.d>0);assert.ok(p.y-p.h/2>=-.01);assert.ok(p.y+p.h/2<=b.h+1.13);}
 }
 for(const name of ['Koreografike','Aristoteli','Mihal Grameno','Ali Demi'])assert.ok(QUARTER.buildings.some(b=>b.name.includes(name)),name);
});

test('roadside and riverbank trees populate both sides without road, water or building obstruction',()=>{
 const paths=HYDROGRAPHY.paths.filter(p=>p.lana).map(p=>riverRing(p,6.9));
 const footpaths=WORLD.roads.filter(r=>r.walk),nearFoot=spatialIndex(footpaths,r=>bounds([r.a,r.b]),60);
 const rows=new Set(),ids=new Set(CANOPY_TREES.map(t=>t.id));
 for(const t of QUARTER.trees){
  assert.ok(ids.has(t.id),`Live canopy owns ${t.id}`);assert.ok(clearStreetPoint(t,1),`Street clearance ${t.id}`);
  assert.ok(!paths.some(p=>inside(t.x,t.z,p)),`River channel clearance ${t.id}`);
  assert.ok(!nearFoot(t.x,t.z,8).some(r=>segmentDistance(t.x,t.z,r.a,r.b)<r.w/2+.64),`Footpath clearance ${t.id}`);
  assert.ok(Math.hypot(t.x-BRIDGE.x,t.z-BRIDGE.z)>17,`Historic bridge remains visible ${t.id}`);
  rows.add(`${t.zone}:${t.side}`);
 }
 assert.equal(rows.size,4);assert.equal(new Set(QUARTER.trees.map(t=>t.id)).size,QUARTER.trees.length);
 const road=QUARTER.trees.filter(t=>t.zone==='quarter-roadside'),bank=QUARTER.trees.filter(t=>t.zone==='quarter-riverbank');
 assert.ok(Math.min(...road.map(t=>t.height))>Math.max(...bank.map(t=>t.height)));
 assert.ok(Math.min(...road.map(t=>t.crown))>Math.max(...bank.map(t=>t.crown)));
});

test('tree sampler rejects occupied sites instead of shifting onto a blocked lane',()=>{
 const roads=[{name:'Rruga Petro Nini Luarasi',a:[700,300],b:[740,300],w:6.2}];
 assert.equal(generateQuarterTrees(roads,[],[],()=>false).length,0);
 const trees=generateQuarterTrees(roads,[],[],()=>true);assert.ok(trees.length>0);
 const duplicate=generateQuarterTrees(roads,[],trees,()=>true);assert.equal(duplicate.length,0);
});

test('business stack fits the opposite mapped frontage and exposes estimate provenance',()=>{
 const [office,bakery]=QUARTER.shops;assert.equal(office.buildingId,bakery.buildingId);assert.ok(office.y>bakery.y+1.5);
 assert.match(office.placementAccuracy,/user-informed estimate/);assert.match(bakery.placementAccuracy,/unverified/);
 const building=byId.get(office.buildingId);
 for(const shop of QUARTER.shops){assert.ok(shop.y+.5<building.h);assert.ok(facadeEdges(building.p).some(e=>{
  const u=(shop.x-e.a[0])*e.ux+(shop.z-e.a[1])*e.uz;
  return segmentDistance(shop.x,shop.z,e.a,e.b)<.15&&u>shop.width/2&&u<e.length-shop.width/2;
 }));}
 const market=QUARTER.storefronts.find(s=>s.id==='node/11386381423');assert.ok(market);assert.ok(Math.hypot(market.x-office.x,market.z-office.z)<50);
});

test('bridge traversal and visible hump share the same profile with no height outside walkway',()=>{
 assert.equal(tabakeveBridgeHeight(BRIDGE.x,BRIDGE.z),bridgeDeckHeight(0));
 for(const u of [-10,-5,0,5,10]){const x=BRIDGE.x+Math.cos(BRIDGE.yaw)*u,z=BRIDGE.z+Math.sin(BRIDGE.yaw)*u;assert.ok(Math.abs(tabakeveBridgeHeight(x,z)-bridgeDeckHeight(u))<1e-9);}
 assert.equal(tabakeveBridgeHeight(BRIDGE.x-Math.sin(BRIDGE.yaw)*3,BRIDGE.z+Math.cos(BRIDGE.yaw)*3),undefined);
 assert.equal(tabakeveBridgeHeight(BRIDGE.x+Math.cos(BRIDGE.yaw)*14,BRIDGE.z+Math.sin(BRIDGE.yaw)*14),undefined);
});
