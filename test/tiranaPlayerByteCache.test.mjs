import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerByteCache} from '../webapp/src/games/tiranastreets/playerModelBytes.mjs';

const glb = (size=24) => {
  const bytes=new ArrayBuffer(size),header=new DataView(bytes);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,size,true);
  return bytes;
};
const gate=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};

test('concurrent preview and game share source download; cancelling one leaves the other intact',async()=>{
  const ready=gate();let requests=0,signal;
  const cache=createPlayerByteCache({fetcher:async(url,options)=>{requests++;signal=options.signal;await ready.promise;return new Response(glb());}});
  try {
    const cancel=new AbortController();
    const preview=cache.load('turi',{signal:cancel.signal}),game=cache.load('turi');
    cancel.abort();await assert.rejects(preview,{name:'AbortError'});assert.equal(signal.aborted,false);
    ready.release();const bytes=await game;assert.equal(requests,1);assert.equal(bytes.byteLength,24);
    assert.equal(await cache.load('turi'),bytes);assert.equal(requests,1);
  }finally{cache.clear();}
});

test('abandoning the last waiter aborts transfer and immediately permits a fresh retry',async()=>{
  const ready=gate();let requests=0,signal;
  const cache=createPlayerByteCache({fetcher:async(url,options)=>{requests++;if(requests===1){signal=options.signal;await ready.promise;}return new Response(glb());}});
  try {
    const cancel=new AbortController(),pending=cache.load('turi',{signal:cancel.signal});
    cancel.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(signal.aborted,true);
    await cache.load('turi');assert.equal(requests,2);ready.release();
    await new Promise(resolve=>setImmediate(resolve));assert.equal(cache.size,1);
  }finally{ready.release();cache.clear();}
});

test('memory budget, LRU and expiry bound source retention',async()=>{
  let time=0,requests=0;
  const cache=createPlayerByteCache({maxBytes:48,maxEntries:2,ttl:1000,now:()=>time,fetcher:async()=>{requests++;return new Response(glb());}});
  try {
    await cache.load('a');await cache.load('b');await cache.load('a');await cache.load('c');
    assert.equal(cache.size,2);assert.equal(cache.byteLength,48);assert.equal(requests,3);
    await cache.load('b');assert.equal(requests,4,'least recently used b was released');
    time=1001;await cache.load('b');assert.equal(requests,5,'expired model must be revalidated');
    await cache.load('b',{reload:true});assert.equal(requests,6,'explicit retry refreshes bytes');
  }finally{cache.clear();assert.equal(cache.byteLength,0);}
});

test('HTTP failure, partial GLB and a streamed oversized response never poison retry cache',async()=>{
  let attempt=0,cancelled=false;
  const cache=createPlayerByteCache({fetcher:async()=>{
    attempt++;
    if(attempt===1)return new Response('',{status:503});
    if(attempt===2)return new Response(glb().slice(0,20));
    if(attempt===3)return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(24*1024*1024+1));},cancel(){cancelled=true;}}));
    return new Response(glb());
  }});
  try {
    await assert.rejects(cache.load('turi'),/503/);await assert.rejects(cache.load('turi'),/complete GLB/);
    await assert.rejects(cache.load('turi'),/24 MB/);assert.equal(cancelled,true);assert.equal(cache.size,0);
    await cache.load('turi');assert.equal(cache.size,1);assert.equal(attempt,4);
  }finally{cache.clear();}
});
