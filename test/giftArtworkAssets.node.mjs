import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {NFT_GIFTS} from '../shared/giftCatalog.js';
import {PREMIUM_GIFT_ART,giftArtworkUrl,giftFallbackUrl,giftSvg} from '../webapp/src/components/gifts/giftArtwork.js';
test('premium artwork exactly covers canonical IDs with distinct paths',()=>{
 assert.deepEqual(Object.keys(PREMIUM_GIFT_ART).sort(),NFT_GIFTS.map(g=>g.id).sort());
 assert.equal(new Set(Object.values(PREMIUM_GIFT_ART)).size,86);
 for(const g of NFT_GIFTS)assert.equal(giftArtworkUrl(g),PREMIUM_GIFT_ART[g.id]);
});
test('assets are local budget-bounded 640px WebP',()=>{
 let total=0;
 for(const path of Object.values(PREMIUM_GIFT_ART)){
 assert.match(path,/^\/assets\/gifts\/tpg\/[a-z_]+\.webp$/);
 const file=new URL('../webapp/public'+path,import.meta.url),b=readFileSync(file);
 assert.equal(b.toString('ascii',0,4),'RIFF'); assert.equal(b.toString('ascii',8,12),'WEBP');
 // Every committed lossy WebP encodes width/height in its VP8 frame header.
 assert.equal(b.toString('ascii',12,16),'VP8 ');
 assert.equal(b.readUInt16LE(26)&16383,640); assert.equal(b.readUInt16LE(28)&16383,640);
 assert.ok(statSync(file).size<80000);total+=b.length;
 }assert.equal(total,3532158);
});
test('unknown ID retains exact SVG fallback',()=>{const g={id:'future',name:'Future',model:'gift'};assert.equal(giftArtworkUrl(g),giftFallbackUrl(g));assert.equal(decodeURIComponent(giftFallbackUrl(g).split(',')[1]),giftSvg(g));});
