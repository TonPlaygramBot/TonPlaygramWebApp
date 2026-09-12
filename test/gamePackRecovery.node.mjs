import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import games from '../webapp/src/config/gamesCatalog.js';
import {GAME_PACK_DEFINITIONS,generateBuiltGamePacks,generateGamePackManifests} from '../webapp/scripts/generate-game-pack-manifests.mjs';
import {FALLBACK_GAME_PACK_CATALOG,GAME_PACK_COMPLETE_PATH,loadGamePackCatalog} from '../webapp/src/pwa/gamePackCatalog.js';
import {installGamePack,cancelGamePackInstall,removeGamePack,getGamePackStatus,getGamePackInstallations,reconcileGamePackInstallations,GAME_PACK_CHANGE_EVENT} from '../webapp/src/pwa/gamePackManager.js';
import {installGamePackFetchInterceptor,matchGamePackCache} from '../webapp/src/pwa/gamePackFetchInterceptor.js';

const origin='https://games.example';
class MemoryCache {
  entries=new Map();
  key(request){return new URL(typeof request==='string'?request:request.url,origin).href;}
  async match(request){return this.entries.get(this.key(request))?.clone();}
  async put(request,response){const bytes=await response.arrayBuffer();this.entries.set(this.key(request),new Response(bytes,{status:response.status,headers:response.headers}));}
  async delete(request){return this.entries.delete(this.key(request));}
  async keys(){return [...this.entries.keys()].map(url=>new Request(url));}
}
class MemoryStorage {
  entries=new Map();
  async open(name){if(!this.entries.has(name))this.entries.set(name,new MemoryCache());return this.entries.get(name);}
  async keys(){return [...this.entries.keys()];}
  async delete(name){return this.entries.delete(name);}
  async match(request){for(const c of this.entries.values()){const r=await c.match(request);if(r)return r;}}
}
let routeFetch,events,storage;
function setup(){
  events=new EventTarget();storage=new Map();globalThis.caches=new MemoryStorage();
  globalThis.window={location:{origin,href:origin+'/games'},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},dispatchEvent:e=>events.dispatchEvent(e),addEventListener:(...args)=>events.addEventListener(...args),removeEventListener:(...args)=>events.removeEventListener(...args),fetch:(...args)=>routeFetch(...args)};
  globalThis.fetch=(...args)=>routeFetch(...args);
}
const asset=(url,body)=>({url,sourceUrl:url,size:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});
const pack=(id,version='v1',dependencies=[])=>({id,title:id,version,dependencies,manifestUrl:`/${id}.json`});
function serve(packs,bodies){
  routeFetch=async input=>{
    const url=new URL(typeof input==='string'?input:input.url,origin).pathname;
    if(url.endsWith('.json')){const p=packs.find(p=>p.manifestUrl===url);return Response.json({...p,assets:Object.entries(bodies[p.id]).map(([url,b])=>asset(url,b))});}
    for(const files of Object.values(bodies))if(url in files)return new Response(files[url]);
    return new Response('missing',{status:404});
  };
}
test('all 17 game slugs have a generated and fallback download definition',()=>{
  for(const game of games){assert.ok(GAME_PACK_DEFINITIONS.some(p=>p.gameSlugs.includes(game.slug)),game.slug);assert.ok(FALLBACK_GAME_PACK_CATALOG.packs.some(p=>p.gameSlugs.includes(game.slug)),game.slug);}
  assert.equal(new Set(GAME_PACK_DEFINITIONS.map(p=>p.id)).size,GAME_PACK_DEFINITIONS.length);
});
test('all download observers see installed after the active flag clears',async()=>{
  setup();const p=pack('demo');serve([p],{demo:{'/demo.glb':'valid-model'}});
  const statuses=[];events.addEventListener(GAME_PACK_CHANGE_EVENT,()=>statuses.push(getGamePackStatus(p)));
  await installGamePack(p.id,{catalog:{packs:[p]}});
  assert.equal(statuses.at(-1),'installed');assert.ok(statuses.includes('downloading'));
  assert.equal(await (await matchGamePackCache(new Request(origin+'/demo.glb'))).text(),'valid-model');
});
test('rejects an HTML fallback instead of installing it as a game asset',async()=>{
  setup();const p=pack('demo');routeFetch=async input=>(typeof input==='string'?input:input.url).endsWith('.json')?Response.json({...p,assets:[{url:'/missing.glb',size:0}]}):new Response('<html>fallback</html>',{headers:{'content-type':'text/html'}});
  await assert.rejects(installGamePack(p.id,{catalog:{packs:[p]}}),/page instead/);
  assert.equal(getGamePackStatus(p),'partial');assert.equal(await matchGamePackCache(new Request(origin+'/missing.glb')),null);
});
test('a failed worker settles before Resume and valid downloaded files are reused',async()=>{
  setup();const p=pack('demo');const files={'/first.glb':'first','/second.glb':'second','/slow.glb':'slow'};serve([p],{demo:files});const native=routeFetch;
  let failures=0,firstFetches=0,slowSettled=false;
  routeFetch=async(input,init)=>{
    if(String(input).endsWith('/first.glb'))firstFetches++;
    if(String(input).endsWith('/second.glb')&&failures++===0){await new Promise(r=>setTimeout(r,15));return new Response('down',{status:503});}
    if(String(input).endsWith('/slow.glb')){await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,30);init.signal.addEventListener('abort',()=>{clearTimeout(timer);slowSettled=true;reject(new DOMException('cancelled','AbortError'));},{once:true});});slowSettled=true;}
    return native(input,init);
  };
  await assert.rejects(installGamePack(p.id,{catalog:{packs:[p]}}),/503/);assert.equal(slowSettled,true);
  await installGamePack(p.id,{catalog:{packs:[p]}});assert.equal(getGamePackStatus(p),'installed');assert.equal(firstFetches,1);
});
test('dependency errors settle the parent and pre-aborted downloads never fetch',async()=>{
  setup();const p=pack('parent','v1',['child']),child=pack('child');serve([p,child],{parent:{'/parent.glb':'p'},child:{'/child.glb':'c'}});const native=routeFetch;
  routeFetch=async(input,init)=>String(input).endsWith('/child.glb')?new Response('fail',{status:503}):native(input,init);
  await assert.rejects(installGamePack('parent',{catalog:{packs:[p,child]}}));assert.equal(getGamePackStatus(p),'partial');assert.match(getGamePackInstallations().parent.lastError,/503/);
  let calls=0;routeFetch=()=>{calls++;throw Error('unexpected');};const abort=new AbortController();abort.abort();await assert.rejects(installGamePack('cancelled',{catalog:{packs:[pack('cancelled')]},signal:abort.signal}),{name:'AbortError'});assert.equal(calls,0);
});
test('failed updates preserve the working version and partially evicted caches require resume',async()=>{
  setup();const old=pack('demo');serve([old],{demo:{'/demo.glb':'old'}});await installGamePack('demo',{catalog:{packs:[old]}});
  const next=pack('demo','v2');serve([next],{demo:{'/demo.glb':'new'}});const native=routeFetch;
  routeFetch=async(input,init)=>String(input).endsWith('/demo.glb')?new Response('fail',{status:503}):native(input,init);
  await assert.rejects(installGamePack('demo',{catalog:{packs:[next]}}));assert.equal(getGamePackStatus(next),'update-available');assert.equal(await (await matchGamePackCache(new Request(origin+'/demo.glb'))).text(),'old');
  const cache=await caches.open(getGamePackInstallations().demo.cacheName);await cache.delete(origin+'/demo.glb');await reconcileGamePackInstallations();assert.equal(getGamePackStatus(next),'partial');assert.equal(await cache.match(origin+GAME_PACK_COMPLETE_PATH),undefined);
});
test('removal waits for an active download and cannot resurrect its cache',async()=>{
  setup();const p=pack('demo');serve([p],{demo:{'/demo.glb':'model'}});const native=routeFetch;let started;const ready=new Promise(r=>started=r);
  routeFetch=async(input,init)=>{if(String(input).endsWith('.glb')){started();await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));}return native(input,init);};
  const pending=installGamePack('demo',{catalog:{packs:[p]}});const rejected=assert.rejects(pending,{name:'AbortError'});await ready;await removeGamePack('demo',{catalog:{packs:[p]}});await rejected;
  assert.equal(getGamePackInstallations().demo,undefined);assert.equal((await caches.keys()).some(k=>k.startsWith('tonplaygram-pack-demo-')),false);
});
test('page and worker interceptors respect no-store and do not expose staging caches',async()=>{
  setup();const cache=await caches.open('tonplaygram-pack-demo-v1');await cache.put(origin+'/demo.glb',new Response('old'));assert.equal(await matchGamePackCache(new Request(origin+'/demo.glb')),null);await cache.put(origin+GAME_PACK_COMPLETE_PATH,new Response('complete'));
  routeFetch=async()=>new Response('new');installGamePackFetchInterceptor();assert.equal(await (await window.fetch('/demo.glb')).text(),'old');assert.equal(await (await window.fetch('/demo.glb',{cache:'no-store'})).text(),'new');
  const self={caches:new MemoryStorage(),location:{origin},fetch:async()=>new Response('new')};const workerCache=await self.caches.open('tonplaygram-pack-demo-v1');await workerCache.put(origin+'/demo.glb',new Response('old'));await workerCache.put(origin+GAME_PACK_COMPLETE_PATH,new Response('complete'));
  vm.runInNewContext(await readFile('webapp/public/pwa/game-pack-service-worker.js','utf8'),{self,Request,URL,Symbol,Promise});
  assert.equal(await (await self.fetch(new Request(origin+'/demo.glb'))).text(),'old');assert.equal(await (await self.fetch(new Request(origin+'/demo.glb'),{cache:'no-store'})).text(),'new');
});
test('a successful catalog fetch survives full metadata storage',async()=>{
  setup();caches.open=async()=>{throw new DOMException('full','QuotaExceededError');};
  const catalog=await loadGamePackCatalog({force:true,fetchImpl:async()=>Response.json({packs:[pack('available')]})});assert.equal(catalog.packs[0].id,'available');
});
test('production packs include executable chunks and media remain in native core',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'packs-built-'));
 try{
  await mkdir(path.join(root,'assets'),{recursive:true});await writeFile(path.join(root,'index.html'),'<div>App</div>');await writeFile(path.join(root,'assets','app-hash.js'),'game code');await writeFile(path.join(root,'assets','app-hash.css'),'body{}');
  const catalog=await generateBuiltGamePacks(root),runtime=catalog.packs.find(p=>p.id==='shared-game-runtime');assert.equal(runtime.assetCount,3);
  for(const p of catalog.packs.filter(p=>!p.hidden))assert.ok(p.dependencies.includes(runtime.id));
  const manifest=JSON.parse(await readFile(path.join(root,'pwa/game-packs/shared-game-runtime.json'),'utf8'));assert.ok(manifest.assets.every(a=>a.nativeRemovable===false));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('main service worker bypasses stale runtime cache for installer requests',async()=>{
 const listeners=new Map();let networkCalls=0,cacheReads=0;
 const self={location:{origin},addEventListener:(name,fn)=>listeners.set(name,fn)};
 const context={self,URL,Request,Response,Symbol,Promise,Set,Map,console,
  importScripts:()=>{},fetch:async()=>{networkCalls++;return new Response('current');},
  caches:{open:async()=>{cacheReads++;return {match:async()=>new Response('stale')};}}};
 vm.runInNewContext(await readFile('webapp/public/service-worker.js','utf8'),context);
 let result;listeners.get('fetch')({request:new Request(origin+'/assets/demo.glb',{cache:'no-store'}),respondWith:p=>{result=p;}});
 assert.equal(await (await result).text(),'current');assert.equal(cacheReads,0);assert.equal(networkCalls,1);
});
