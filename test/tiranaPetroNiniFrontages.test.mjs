import assert from 'node:assert/strict';
import test from 'node:test';
import {petroNiniFrontages} from '../webapp/src/games/tirana-tabakeve/petroNiniFrontages.mjs';
import {QUARTER} from '../webapp/src/games/tirana-tabakeve/quarterData.mjs';

test('the mapped bakery bay and Century 21 are vertically aligned',()=>{
 const p=petroNiniFrontages();
 assert.ok(p);
 assert.equal(p.bakery.buildingId,'620371610');
 assert.equal(p.bakery.elevation,'basement');
 assert.equal(p.office.elevation,'upper');
 assert.ok(p.office.y-p.bakery.y>=3);
 assert.equal(p.office.x,p.bakery.x);
 assert.equal(p.office.z,p.bakery.z);
 assert.equal(p.office.yaw,p.bakery.yaw);
 const b=QUARTER.buildings.find(b=>b.id===p.bakery.buildingId);
 const e=b.edges.find(e=>e.yaw===p.bakery.yaw);
 const s=(p.bakery.x-e.a[0])*e.ux+(p.bakery.z-e.a[1])*e.uz;
 assert.ok(s>p.bakery.width/2&&s<e.length-p.bakery.width/2);
 assert.ok(p.office.y+1<b.h);
});
test('KMY and Vjosa retain existing frontage identities rather than adding duplicates',()=>{
 const p=petroNiniFrontages();
 assert.equal(p.market.buildingId,p.bakery.buildingId);
 assert.equal(p.restaurant.buildingId,'651919189');
 assert.equal(p.opposite.buildingId,'443994901');
 const vx=p.restaurant.x-p.bakery.x,vz=p.restaurant.z-p.bakery.z;
 const along=((p.market.x-p.bakery.x)*vx+(p.market.z-p.bakery.z)*vz)/(vx*vx+vz*vz);
 assert.ok(along>0&&along<1);
 assert.equal(petroNiniFrontages({...QUARTER,storefronts:[]}),null);
});
