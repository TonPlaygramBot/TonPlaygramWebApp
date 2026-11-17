import test from 'node:test';
import { statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { NFT_GIFTS, GIFT_BY_ID, GIFT_COLLECTIONS, filterGifts } from '../shared/giftCatalog.js';
import { NFT_GIFTS as server } from '../bot/utils/nftGifts.js';
import { NFT_GIFTS as client } from '../webapp/src/utils/nftGifts.js';
import { GIFT_MOTIFS, giftSvg, giftArtworkUrl, PREMIUM_GIFT_ART, giftFallbackUrl } from '../webapp/src/components/gifts/giftArtwork.js';
import { createGiftCheckout as checkoutFactory } from '../webapp/src/components/gifts/giftCheckout.js';
const testRequestId='11111111-1111-4111-8111-111111111111';
const memoryStorage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const createGiftCheckout=(send, options={})=>checkoutFactory(send,{storage:memoryStorage(),uuid:()=>testRequestId,...options});
const receipt=(giftId='fireworks',to='b')=>({requestId:testRequestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:giftId,toAccount:to,amount:-GIFT_BY_ID[giftId].price}});
const original={fireworks:200,laugh_bomb:300,pizza_slice:500,coffee_boost:750,baby_chick:1000,poop:1200,speed_racer:1800,bullseye:3000,magic_trick:5000,surprise_box:8000,dragon_burst:20000,rocket_blast:35000,royal_crown:90000,alien_visit:150000};
test('86 gifts, 72 new designs and nine collections',()=>{assert.equal(NFT_GIFTS.length,86);assert.equal(NFT_GIFTS.filter(g=>g.isNew).length,72);assert.equal(new Set(NFT_GIFTS.map(g=>g.collection)).size,9);});
test('original IDs/prices/tiers retained',()=>{Object.entries(original).forEach(([id,price],index)=>{assert.equal(GIFT_BY_ID[id].price,price);assert.equal(GIFT_BY_ID[id].tier,index<5?1:index<10?2:3);});});
test('unique stable IDs, names and fallback icons',()=>{for(const key of ['id','name','icon'])assert.equal(new Set(NFT_GIFTS.map(g=>g[key])).size,86,key);});
test('server and client use the same canonical objects',()=>{assert.equal(server,client);assert.equal(client,NFT_GIFTS);});
test('all entries have safe palettes, positive integer prices, known tiers and original artwork',()=>{for(const gift of NFT_GIFTS){assert.match(gift.id,/^[a-z][a-z0-9_]+$/);assert.ok(Number.isSafeInteger(gift.price)&&gift.price>0);assert.ok([1,2,3].includes(gift.tier));assert.ok(GIFT_COLLECTIONS.includes(gift.collection));assert.match(gift.color,/^#[a-f0-9]{6}$/i);assert.match(gift.accent,/^#[a-f0-9]{6}$/i);assert.ok(GIFT_MOTIFS[gift.model],gift.id);assert.ok(giftFallbackUrl(gift).startsWith('data:image/svg+xml;'));assert.equal(giftArtworkUrl(gift),PREMIUM_GIFT_ART[gift.id] || giftFallbackUrl(gift));}});
test('all 71 original motifs render without remote assets or scripts',()=>{assert.equal(Object.keys(GIFT_MOTIFS).length,71);for(const g of NFT_GIFTS){const svg=giftSvg(g);assert.ok(svg.includes('<title>'));assert.doesNotMatch(svg,/<script|<foreignObject|href=|onload=/i);}});
test('SVG names are escaped',()=>{assert.ok(giftSvg({...NFT_GIFTS[0],name:'<bad & "x">'}).includes('&lt;bad &amp; &quot;x&quot;&gt;'));});
test('search, collection and tier compose without mutating catalog',()=>{const before=NFT_GIFTS.map(g=>g.id);assert.equal(filterGifts({search:'  SATURN  '})[0].id,'saturn_silk');assert.equal(filterGifts({collection:'Cosmos',tier:'1'}).length,0);assert.equal(filterGifts({collection:'Royal'}).length,9);assert.equal(filterGifts({search:'not-a-real-gift'}).length,0);const sorted=filterGifts({sort:'price-asc'});sorted.forEach((g,i)=>{if(i)assert.ok(g.price>=sorted[i-1].price);});assert.deepEqual(NFT_GIFTS.map(g=>g.id),before);});
test('checkout only sends trimmed IDs; no client price',async()=>{let args;const buy=createGiftCheckout(async(...a)=>{args=a;return receipt('saturn_silk','bob');});await buy({fromAccount:' alice ',toAccount:' bob ',giftId:'saturn_silk',price:0});assert.deepEqual(args,['alice','bob','saturn_silk',testRequestId]);});
test('checkout rejects invalid identity/catalog before sending',async()=>{let calls=0;const buy=createGiftCheckout(async()=>{calls++;return receipt();});await assert.rejects(buy({fromAccount:'',toAccount:'b',giftId:'fireworks'}));await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fake'}));assert.equal(calls,0);});
test('rapid duplicate confirms do not start a second request',async()=>{let release,calls=0;const buy=createGiftCheckout(()=>{calls++;return new Promise(resolve=>{release=resolve;});});const args={fromAccount:'a',toAccount:'b',giftId:'fireworks'};const first=buy(args);assert.deepEqual(await buy(args),{ignored:true});release(receipt());await first;assert.equal(calls,1);});
test('server JSON errors are failures, not success messages',async()=>{const buy=createGiftCheckout(async()=>({error:'Insufficient balance'}));await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}),/Insufficient balance/);});
test('failed requests release latch for a later explicit retry',async()=>{let calls=0;const buy=createGiftCheckout(async()=>{calls++;if(calls===1)throw new Error('Offline');return receipt();});const order={fromAccount:'a',toAccount:'b',giftId:'fireworks'};await assert.rejects(buy(order),/Offline/);assert.ok((await buy(order)).result.transaction);assert.equal(calls,2);});
test('ambiguous empty responses are not presented as delivered',async()=>{const buy=createGiftCheckout(async()=>null);await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}),/could not be confirmed/);});

test('premium assets are local, bounded and mapped only to known IDs',()=>{assert.equal(Object.keys(PREMIUM_GIFT_ART).length,86);for(const [id,path] of Object.entries(PREMIUM_GIFT_ART)){assert.ok(GIFT_BY_ID[id]);assert.match(path,/^\/assets\/gifts\/tpg\/[a-z_]+\.webp$/);assert.ok(statSync(new URL('../webapp/public'+path,import.meta.url)).size<80000);}});

test('empty or mismatched receipts cannot confirm delivery',async()=>{for(const result of [{},{success:true},{...receipt(),balance:undefined},{...receipt(),transaction:{...receipt().transaction,detail:'royal_crown'}},{...receipt(),transaction:{...receipt().transaction,toAccount:'other'}},{...receipt(),transaction:{...receipt().transaction,amount:0}}]){const buy=createGiftCheckout(async()=>result);await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}),/could not be confirmed/);}});

test('ambiguous retry after checkout recreation uses persisted request ID',async()=>{
 const storage=memoryStorage();let firstKey;
 const first=createGiftCheckout(async(from,to,gift,id)=>{firstKey=id;throw new Error('lost response');},{storage});
 const order={fromAccount:'a',toAccount:'b',giftId:'fireworks'};
 await assert.rejects(first(order));
 const second=createGiftCheckout(async(from,to,gift,id)=>{assert.equal(id,firstKey);return receipt();},{storage,uuid:()=>{throw new Error('must not generate new key');}});
 assert.equal(second.recover('a').requestId,firstKey);await second(order);assert.equal(second.recover('a'),null);
});
test('ambiguous request prevents different gift or recipient while preserving original',async()=>{
 const buy=createGiftCheckout(async()=>{throw new Error('offline');});const order={fromAccount:'a',toAccount:'b',giftId:'fireworks'};
 await assert.rejects(buy(order));await assert.rejects(buy({...order,giftId:'royal_crown'}),/previous gift/);await assert.rejects(buy({...order,toAccount:'c'}),/previous gift/);assert.equal(buy.recover('a').giftId,'fireworks');assert.equal(buy.recover('other'),null);
});
test('unavailable storage fails closed before sending',async()=>{let sent=false;const buy=createGiftCheckout(async()=>{sent=true;},{storage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}}});await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}),/save gift recovery/);assert.equal(sent,false);});
test('preflight rejection and mismatched response key retain ambiguous intent',async()=>{for(const result of [{error:'auth expired',rejected:true,requestId:testRequestId},{...receipt(),requestId:'22222222-2222-4222-8222-222222222222'}]){const buy=createGiftCheckout(async()=>result);await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}));assert.equal(buy.recover('a').requestId,testRequestId);}});

test('matching immutable rejection releases intent but wrong-key rejection does not',async()=>{for(const matches of [true,false]){const buy=createGiftCheckout(async()=>({error:'insufficient',requestId:matches?testRequestId:'different',requestStatus:'rejected'}));await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}));assert.equal(Boolean(buy.recover('a')),!matches);}});
test('corrupt recovery storage and missing secure UUID cannot transmit',async()=>{for(const options of [{storage:{getItem:()=>'{broken'}},{uuid:()=>undefined}]){let sent=false;const buy=createGiftCheckout(async()=>{sent=true;},options);await assert.rejects(buy({fromAccount:'a',toAccount:'b',giftId:'fireworks'}));assert.equal(sent,false);}});
