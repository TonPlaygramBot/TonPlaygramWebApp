import test from 'node:test';
import assert from 'node:assert/strict';
import {acquisitionTiles,mergeAcquisition} from '../webapp/scripts/tirana/regionAcquisition.mjs';
import {REGION_REFERENCES,REGION_BBOX,buildRegionQuery} from '../webapp/src/games/tirana-region/regionCore.mjs';
import {project} from '../webapp/src/games/tirana-expansion/geography.mjs';
import {panoramaBlend,panoramaVisible,DURRES_REFERENCE} from '../webapp/src/games/tirana-region/panoramaCore.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {importRegionSource} from '../webapp/scripts/tirana/regionImport.mjs';
const options={origin:WORLD.origin,sourceURL:'https://overpass-api.de/api/interpreter',acquiredAt:'2026-09-11T00:00:00Z',sha256:'a'.repeat(64)};
test('acquisition covers every requested district in contiguous bounded tiles',()=>{
 const tiles=acquisitionTiles();assert.equal(tiles.length,30);
 for(const id of ['rinas','vaqarr','sauk','farke','dajti-summit']){const p=REGION_REFERENCES.find(p=>p.id===id);assert.ok(p);assert.ok(tiles.some(({bbox:[w,s,e,n]})=>p.longitude>=w&&p.longitude<=e&&p.latitude>=s&&p.latitude<=n));}
 assert.equal(tiles[0].bbox[0],REGION_BBOX[0]);assert.deepEqual(tiles.at(-1).bbox.slice(2),REGION_BBOX.slice(2));
 assert.throws(()=>acquisitionTiles([0,0,1,1],.01),/100/);assert.throws(()=>acquisitionTiles(REGION_BBOX,0),/step/);
});
test('query includes businesses, government, public services and attractions',()=>{
 const q=buildRegionQuery();for(const tag of ['nwr[shop]','nwr[amenity]','nwr[office]','nwr[tourism]','nwr[historic]','way[aeroway]','relation[building]','way["building:part"]'])assert.ok(q.includes(tag));
 assert.throws(()=>buildRegionQuery([20,42,19,41]),/bbox/);
});
test('tile merge deduplicates complete identities and fails on partial or conflicting data',()=>{
 const e={type:'node',id:1,lat:41.3,lon:19.8};const tile={elements:[e],osm3s:{timestamp_osm_base:'2026-09-11T00:00:00Z'}};
 assert.equal(mergeAcquisition([tile,tile]).elements.length,1);
 assert.throws(()=>mergeAcquisition([tile,{elements:[]}]),/incomplete/);
 assert.throws(()=>mergeAcquisition([tile,{elements:[{...e,lat:41.4}]}]),/Conflicting/);
 assert.throws(()=>mergeAcquisition([tile,{...tile,remark:'timeout'}]),/incomplete/);
 assert.equal(mergeAcquisition([tile,{...tile,osm3s:{timestamp_osm_base:'2026-09-12T00:00:00Z'}}]).elements.length,1);
 assert.throws(()=>mergeAcquisition([{elements:[{...e,timestamp:'2026-09-12T00:00:00Z'}]}],{snapshot:'2026-09-11T00:00:00Z'}),/newer/);
});
test('public place nodes remain points, campus relations never become buildings',()=>{
 const raw={elements:[{type:'node',id:1,lat:41.3,lon:19.8,tags:{amenity:'school',name:'Synthetic test school'}},{type:'node',id:2,lat:41.301,lon:19.801},{type:'way',id:3,nodes:[1,2],tags:{highway:'residential'}},{type:'relation',id:4,members:[{type:'way',ref:3,role:'outer'}],tags:{amenity:'hospital',type:'multipolygon'}}]};
 const result=importRegionSource(raw,options);assert.equal(result.places.length,2);assert.equal(result.buildings.length,0);assert.equal(result.places[0].buildingId,null);assert.ok(result.places[0].point);assert.ok(result.places[1].members);assert.equal(result.runtimeReady,false);
});
test('panorama is altitude-gated and Durrës stays west at geographic scale',()=>{
 assert.equal(panoramaBlend(1.68),0);assert.equal(panoramaBlend(1050),1);assert.equal(panoramaBlend(NaN),0);
 assert.equal(panoramaVisible({x:0,y:1.68,z:0},WORLD.bounds),false);
 assert.equal(panoramaVisible({x:7200,y:1050,z:-4500},WORLD.bounds),true);
 assert.equal(panoramaVisible({x:100000,y:1050,z:0},WORLD.bounds),false);
 const p=project(WORLD.origin,DURRES_REFERENCE.latitude,DURRES_REFERENCE.longitude);assert.ok(p.x<-30000&&p.x>-32000);assert.ok(Math.abs(p.z)<2000);
});
