import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {WORLD as SOLO} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {lakeShoreTexture,selectMappedLakes} from '../webapp/src/games/tirana-environment/mappedLakeCore.mjs';

test('two distinct exact mapped lake footprints, no invented substitute basin',()=>{
 const sites=selectMappedLakes(WORLD.waterAreas);
 assert.deepEqual(sites.map(s=>[s.id,s.profile.name,s.polygons[0].outer.length]),[
  ['way/249196321','Liqeni Artificial i Tiranës',690],
  ['way/466431832','Liqeni i Thatë',317]
 ]);
 assert.deepEqual(selectMappedLakes(SOLO.waterAreas),sites);
 for(const s of sites)assert.equal(s.polygons[0],WORLD.waterAreas.find(p=>p.id===s.id).polygons[0],
  'Use each original polygon record object, never move its shore');
 assert.deepEqual(selectMappedLakes([{id:'way/999999',polygons:sites[0].polygons}]),[]);
});

test('shore distance includes island boundary and saturates toward the lake interior',()=>{
 const polygon={outer:[[0,0],[100,0],[100,100],[0,100]],holes:[[[15,30],[25,30],[25,40],[15,40]]]};
 const size=128;
 const s=lakeShoreTexture([polygon],size,18);
 const sample=(x,z)=>s.data[Math.min(size-1,Math.floor((z-s.minZ)*size/s.depth))*size+Math.min(size-1,Math.floor((x-s.minX)*size/s.width))];
 assert.ok(sample(0,50)<12);
 assert.ok(sample(7,50)>80&&sample(7,50)<120);
 assert.ok(sample(25,35)<12);
 assert.equal(sample(60,60),255);
 assert.ok(sample(-5,50)>50&&sample(-5,50)<100);
});
