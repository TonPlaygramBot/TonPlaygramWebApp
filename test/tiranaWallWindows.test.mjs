import assert from 'node:assert/strict';
import {test} from 'node:test';
import {wallWindowProjection,windowVertex,windowGlassWidth} from '../webapp/src/games/tirana-neighbourhood/wallWindows.mjs';

const apt={h:19,tags:{building:'apartments'}};
const rows=[{y:4.7,height:1.65},{y:8,height:1.65},{y:11.3,height:1.65}];
const decode=([x,y,z])=>[x*24/65535,y*128/65535-2,z*128/65535];
test('fallback apertures line up with modeled windows along an entire diagonal wall',()=>{
 const p=wallWindowProjection(apt,rows,16.7);
 assert.equal(p.columns,4);assert.equal(p.max,3);
 for(const [i,row] of rows.entries())for(let column=0;column<4;column++){
  const uv=decode(windowVertex(p,(column+.5)/4,row.y));
  assert.ok(Math.abs(uv[0]-column-.5)<.002);
  assert.ok(Math.abs(uv[1]-i-.5)<.002);
  assert.ok(Math.abs(uv[2]-3)<.002);
 }
});
test('mapped but unspecified civilian shells work; protected, tiny and windowless shells are unchanged',()=>{
 assert(wallWindowProjection({...apt,tags:{building:'yes'}},rows,12));
 for(const b of [{...apt,special:'landmark'},{...apt,tags:{...apt.tags,historic:'yes'}},{...apt,tags:{building:'warehouse'}},
   {...apt,tags:{building:'construction'}},{...apt,tags:{...apt.tags,amenity:'school'}}]){
  assert.equal(wallWindowProjection(b,rows,12),null);
 }
 assert.equal(wallWindowProjection(apt,[],12),null);
 assert.equal(wallWindowProjection(apt,rows,3.99),null);
 assert.deepEqual(windowVertex(null,0,0),[0,0,0,0]);
});
test('single-storey placeholders retain one row and dense buildings respect the modeled 24-bay cap',()=>{
 const p=wallWindowProjection({h:7,tags:{building:'house'}},[rows[0]],150);
 assert.equal(p.columns,24);assert.equal(p.max,1);assert.ok(p.spacing>7);
});

test('fallback apertures match near mesh size on short retail and long capped walls',()=>{
 for(const [width,building,windows] of [[16.7,{h:7,tags:{building:'retail'}},[rows[0]]],[150,apt,rows]]){
  const projection=wallWindowProjection(building,windows,width);
  const packed=windowVertex(projection,0,0)[3];
  const bay=width/projection.columns;
  assert.ok(Math.abs(Math.floor(packed/256)*bay/255-windowGlassWidth(bay))<.014);
  assert.ok(Math.abs((packed%256)*projection.spacing/255-windows[0].height)<.02);
 }
});
