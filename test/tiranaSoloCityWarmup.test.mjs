import assert from 'node:assert/strict';
import test from 'node:test';
import {createCityAssetByteCache} from '../webapp/src/games/tiranastreets-november/cityAssetBytes.mjs';
import {SOLO_CITY_PATH, warmSoloCity} from '../webapp/src/games/tiranastreets-november/soloCityWarmup.mjs';

test('Save-Data, 2G and a cancelled route do not prewarm the city', async () => {
  let n=0;
  const load=()=>{n++;};
  for (const connection of [{saveData:true}, {effectiveType:'2g'}, {effectiveType:'slow-2g'}])
    assert.equal(await warmSoloCity({connection,load}),false);
  assert.equal(await warmSoloCity({signal:AbortSignal.abort(),load}),false);
  assert.equal(n,0);
});

test('warm and live loaders share one cold network request, and warm reuse starts none', async () => {
  const bytes=new ArrayBuffer(20),header=new DataView(bytes);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,20,true);
  let count=0,release;
  const cached=createCityAssetByteCache({fetcher:()=>{count++;return new Promise(resolve=>{release=()=>resolve({ok:true,arrayBuffer:async()=>bytes});});}});
  const route=new AbortController();
  const early=warmSoloCity({signal:route.signal,load:cached.load});
  const nowRequired=cached.load(SOLO_CITY_PATH);
  route.abort();
  assert.equal(await early,false,'abandoned subscriber leaves live request intact');
  release();assert.equal(await nowRequired,bytes);
  assert.equal(await warmSoloCity({load:cached.load}),true);
  assert.equal(count,1);
  cached.clear();
});

test('optional warmup failure resolves false and does not block core error handling', async () => {
  assert.equal(await warmSoloCity({load:()=>{throw Error('synthetic network unavailable');}}),false);
});
