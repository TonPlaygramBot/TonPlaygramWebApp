import test from 'node:test';
import assert from 'node:assert/strict';
import {mapBounds,mapTransform,pointerUnit,transformPointers,FAVORITES_KEY,readMapFavorites,writeMapFavorites} from './districtMapControls.mjs';
const box=mapBounds('0 0 1000 600'),rect={left:0,top:0,width:320,height:200};
const points=[{x:70,y:90},{x:170,y:110}];

test('letterbox coordinates and moving pinch preserve the anchor fixed on its centroid',()=>{
 const next=[{x:40,y:68},{x:260,y:112}];
 const v=transformPointers(box,box,points,next,rect);
 const a=pointerUnit({x:120,y:100},rect,box),b=pointerUnit({x:150,y:90},rect,v);
 assert.ok(Math.abs(a.x*box.w-(v.x+b.x*v.w))<1e-8);
 assert.ok(Math.abs(a.z*box.h-(v.z+b.z*v.h))<1e-8);
 assert.ok(v.w<box.w/2);
});
test('single pointer translates without scale; huge pan and zoom cannot leave map bounds',()=>{
 const mid={x:.5,z:.5},v=mapTransform(box,box,mid,mid,5);
 const moved=transformPointers(box,v,[{x:120,y:100}],[{x:160,y:120}],rect);
 assert.equal(moved.w,v.w);assert.ok(moved.x<v.x&&moved.z<v.z);
 const edge=mapTransform(box,moved,{x:.5,z:.5},{x:-100,z:100},500);
 assert.equal(edge.w,box.w/8);assert.equal(edge.z,box.z);assert.equal(edge.x+edge.w,box.w);
});
test('legacy favorites are read-only, scrub coordinates and stale IDs, and fail storage gracefully',()=>{
 const legacy='tpg:tirana:places:v1';
 const saved=new Map([[legacy,JSON.stringify({version:1,places:[{id:'pyramid',x:99999,name:'wrong'},{id:'__proto__'},{id:'pin:4:2'},{id:'pyramid'},null]})]]);
 const storage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 assert.deepEqual(readMapFavorites(storage),['pyramid']);
 assert.equal(saved.has(FAVORITES_KEY),false);
 assert.equal(writeMapFavorites(storage,['pyramid','__proto__','clock','pyramid']),true);
 assert.deepEqual(JSON.parse(saved.get(FAVORITES_KEY)),{version:1,ids:['pyramid','clock']});
 assert.ok(saved.get(legacy).includes('99999'));
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.deepEqual(readMapFavorites(blocked),[]);assert.equal(writeMapFavorites(blocked,['lana']),false);
});
