import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityAssetByteCache} from '../webapp/src/games/tiranastreets/cityAssetBytes.mjs';
import {FleetSelection} from '../webapp/src/games/tiranastreets/shared/fleetSelection.mjs';

const glb=(length=32)=>{const bytes=new ArrayBuffer(length),view=new DataView(bytes);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,length,true);return bytes;};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('independent city owners share one download; cancelling one owner keeps the other alive',async()=>{
  const wait=deferred(),calls=[];
  const cache=createCityAssetByteCache({fetcher:async(url,options)=>{calls.push({url,options});await wait.promise;return new Response(glb());}});
  const abort=new AbortController();
  const first=cache.load('/police.glb',{signal:abort.signal}),second=cache.load('/police.glb');
  assert.equal(calls.length,1);abort.abort();await assert.rejects(first,{name:'AbortError'});
  assert.equal(calls[0].options.signal.aborted,false);
  wait.resolve();const bytes=await second;assert.equal(bytes.byteLength,32);
  assert.equal(await cache.load('/police.glb'),bytes);assert.equal(calls.length,1);
  cache.clear();
});

test('streaming bounds concurrent transfers and cancelled queued assets never download',async()=>{
  const waits=new Map(),calls=[];
  const cache=createCityAssetByteCache({maxActive:2,fetcher:async url=>{calls.push(url);const wait=deferred();waits.set(url,wait);await wait.promise;return new Response(glb());}});
  const a=cache.load('/a.glb'),b=cache.load('/b.glb'),abort=new AbortController();
  const c=cache.load('/cancel.glb',{signal:abort.signal}),d=cache.load('/d.glb');
  abort.abort();await assert.rejects(c,{name:'AbortError'});
  assert.deepEqual(calls,['/a.glb','/b.glb']);assert.equal(cache.activeCount,2);
  waits.get('/a.glb').resolve();await a;await flush();
  assert.deepEqual(calls,['/a.glb','/b.glb','/d.glb']);assert.equal(cache.activeCount,2);
  waits.get('/b.glb').resolve();waits.get('/d.glb').resolve();await Promise.all([b,d]);cache.clear();
});

test('LRU bytes stay bounded, errors retry, and invalid responses never enter the cache',async()=>{
  let calls=0,time=0;
  const cache=createCityAssetByteCache({maxBytes:64,maxEntries:2,ttl:1000,now:()=>time,fetcher:async url=>{
    calls++;if(url==='/bad.glb')return new Response('<html>missing file</html>');return new Response(glb());
  }});
  await cache.load('/a.glb');await cache.load('/b.glb');await cache.load('/a.glb');await cache.load('/c.glb');
  assert.equal(cache.byteLength,64);assert.equal(cache.size,2);assert.equal(calls,3);
  await cache.load('/b.glb');assert.equal(calls,4);
  time=1001;await cache.load('/b.glb');assert.equal(calls,5);
  await assert.rejects(cache.load('/bad.glb'),/complete GLB/);
  await assert.rejects(cache.load('/bad.glb'),/complete GLB/);assert.equal(calls,7);
  cache.clear();assert.equal(cache.byteLength,0);
});

test('last consumer cancellation permits an immediate retry without poisoning the new result',async()=>{
  const calls=[];
  const cache=createCityAssetByteCache({fetcher:async(url,{signal})=>{
    calls.push(signal);
    if(calls.length===1)await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    return new Response(glb());
  }});
  const abort=new AbortController(),first=cache.load('/asset.glb',{signal:abort.signal});abort.abort();
  await assert.rejects(first,{name:'AbortError'});
  assert.equal((await cache.load('/asset.glb')).byteLength,32);assert.equal(calls.length,2);cache.clear();
});

test('fleet ranking is bounded while selected vehicles keep current poses at every frame',()=>{
  let considered=0;
  const selection=new FleetSelection({maxVisible:3,eligible:()=>{considered++;return true;}});
  const cars=Array.from({length:2000},(_,i)=>({id:String(i),x:i,z:0}));
  for(let frame=0;frame<120;frame++){
    cars[0].x=frame*.001;
    const chosen=selection.select(cars,{x:0,z:0},undefined,frame*1000/60);
    assert.equal(chosen[0],cars[0]);assert.equal(chosen[0].x,frame*.001);
  }
  assert.ok(considered<=20360,`at most ten whole-fleet rankings plus selected-car validation, observed ${considered} candidate checks`);
  const player=selection.select(cars,{x:0,z:0},'1999',2001);
  assert.equal(player[0].id,'1999','controlled vehicle is kept even beyond streaming range');
  const nearby=selection.select(cars,{x:1000,z:0},undefined,2002);
  assert.equal(nearby[0].id,'1000','teleport refreshes immediately');
  const replacement=cars.map(c=>({...c}));replacement[1000].x=0;
  assert.equal(selection.select(replacement,{x:0,z:0},undefined,2003)[0],replacement[1000]);
});
test('a selected car that becomes invalid or changes visual ownership is removed before the next rank',()=>{
  const cars=[{id:'a',x:0,z:0,visible:true},{id:'b',x:1,z:0,visible:true}];
  const selection=new FleetSelection({eligible:car=>car.visible});
  assert.equal(selection.select(cars,{x:0,z:0},undefined,0).length,2);
  cars[0].visible=false;cars[1].x=NaN;
  assert.deepEqual(selection.select(cars,{x:0,z:0},undefined,16),[]);
});
