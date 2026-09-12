import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(new URL('../webapp/.weapon-api-test-',import.meta.url).pathname),file=dir+'/api.mjs';
test.after(()=>rm(dir,{recursive:true,force:true}));
await build({entryPoints:[new URL('../webapp/src/games/tiranastreets/weaponStoreApi.ts',import.meta.url).pathname],outfile:file,bundle:true,format:'esm',platform:'node',plugins:[{name:'account-fixture',setup(b){
 b.onResolve({filter:/utils\/(telegram\.js|api\.js|nativeBridge)$/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:path.endsWith('telegram.js')?'export const ensureAccountId=async()=>globalThis.testAccount;':path.endsWith('api.js')?'export const API_BASE_URL="https://api.example.test";':'export const getNativeBridgeHeaders=()=>({"x-native-session":"test"});',loader:'js'}));
}}]});
const api=await import(pathToFileURL(file));
const originals={fetch:globalThis.fetch,window:globalThis.window,localStorage:globalThis.localStorage};
globalThis.window={Telegram:{WebApp:{initData:'signed-test-init'}}};const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
test.after(()=>{Object.assign(globalThis,originals);delete globalThis.testAccount;});

test('lost response retains purchase reference across module reload and uses the shared backend and auth headers',async()=>{
 globalThis.testAccount='account-A';const calls=[];globalThis.fetch=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});throw Error('connection lost');};
 await assert.rejects(api.purchaseWeapon('tirana-ak47VolleyAttack'),/connection lost/);assert.equal(saved.size,1);
 const again=await import(pathToFileURL(file)+'?reload');globalThis.fetch=async(url,init)=>{calls.push({url,init,body:JSON.parse(init.body)});return new Response(JSON.stringify({balanceTPG:500,ownedWeaponIds:['ak47VolleyAttack']}),{status:200});};
 await again.purchaseWeapon('tirana-ak47VolleyAttack');assert.equal(calls[0].body.idempotencyKey,calls[1].body.idempotencyKey);assert.equal(saved.size,0);
 assert.equal(calls[1].url,'https://api.example.test/api/tirana-store/purchase');assert.equal(calls[1].init.headers['x-tpc-account-id'],'account-A');assert.equal(calls[1].init.headers['x-telegram-init-data'],'signed-test-init');assert.equal(calls[1].init.headers['x-native-session'],'test');
});
test('definitive rejection clears pending purchase, while account changes cannot reuse its reference',async()=>{
 globalThis.testAccount='account-B';const keys=[];globalThis.fetch=async(_url,init)=>{keys.push(JSON.parse(init.body).idempotencyKey);return new Response(JSON.stringify({code:'INSUFFICIENT_TPG',error:'Insufficient TPG'}),{status:402});};
 await assert.rejects(api.purchaseWeapon('tirana-uziSprayAttack'),e=>e.code==='INSUFFICIENT_TPG'&&e.status===402);assert.equal(saved.size,0);
 globalThis.testAccount='account-C';await assert.rejects(api.purchaseWeapon('tirana-uziSprayAttack'));assert.notEqual(keys[0],keys[1]);assert.equal(saved.size,0);
});
