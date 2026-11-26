import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { HYDROGRAPHY } from '../webapp/src/games/tirana-environment/hydrography.mjs';
import { riverRing } from '../webapp/src/games/tirana-environment/riverShapeCore.mjs';
import { polygonHas, roadCorridor } from '../webapp/src/games/tirana-environment/surfaceCore.mjs';
import { clipParkSurfaces } from '../webapp/src/games/tirana-environment/parkClip.mjs';

test('park turf does not cover a road, and parks outside the cutoff remain', () => {
 const rect=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d]];
 const result=clipParkSurfaces([rect(0,0,10,10),rect(20,20,30,30)],[rect(4,-1,6,11)]);
 assert.deepEqual(result.failures,[]);
 assert.ok(result.polygons.some(p=>polygonHas([2,2],p)));
 assert.ok(result.polygons.some(p=>polygonHas([25,25],p)));
 assert.ok(result.polygons.every(p=>!polygonHas([5,5],p)));
});

test('restored Tirana parks survive the near-coincident sweep seam', () => {
 const waterCuts=WORLD.water.flatMap(w=>Array.isArray(w)?[w]:(w.line||[]).slice(1).map((b,i)=>roadCorridor({a:w.line[i],b,w:w.width},.5)).filter(Boolean));
 const cuts=[...HYDROGRAPHY.paths.map(p=>riverRing(p)),...waterCuts,...WORLD.areas,...WORLD.buildings.map(b=>b.p),...WORLD.roads.map(r=>roadCorridor(r,r.walk?.2:2.5)).filter(Boolean)];
 const result=clipParkSurfaces(WORLD.parks,cuts);
 assert.deepEqual(result.failures,[]);
 assert.ok(result.polygons.length>=280);
});
