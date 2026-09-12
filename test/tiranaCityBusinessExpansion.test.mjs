import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {CITY_BUSINESS_BUILDING_PROFILES,CITY_BUSINESS_OBSERVED_HEIGHTS} from '../webapp/src/games/tirana-city-source/cityBusinessProfiles.mjs';
import {NEIGHBOURHOOD_REFERENCE_PROFILES} from '../webapp/src/games/tirana-city-source/neighbourhoodProfiles.mjs';
import {BUSINESS_SIGNS} from '../webapp/src/games/tirana-city-source/businessSignRegistry.mjs';
import {CITY_BUSINESS_SIGN_REFERENCES} from '../webapp/src/games/tirana-street-life/cityBusinessSignReferences.mjs';
import {SIGN_REFERENCES,signReferenceFor} from '../webapp/src/games/tirana-street-life/signReferences.mjs';
import {STREET_LIFE} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
const dir=await mkdtemp(join(tmpdir(),'tirana-city-business-'));let api;
try{const file=join(dir,'api.mjs');await build({stdin:{contents:`export {ReferenceFacades} from './src/games/tirana-city-source/ReferenceFacades';export {cityBusinessDetails} from './src/games/tirana-city-source/CityBusinessDetails';export {createBrandArtworkCache} from './src/games/tirana-street-life/brandArtworkCache';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}

test('33 additional identities have original packaged artwork, exact mapped matches and bounded bytes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../webapp/public/assets/tirana-streets/signs/city-business-sources.json',import.meta.url)));
 assert.equal(manifest.length,33);assert.equal(CITY_BUSINESS_SIGN_REFERENCES.length,33);assert.equal(SIGN_REFERENCES.length,74);
 const signs=[...BUSINESS_SIGNS,...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts];
 let bytes=0,placements=0;
 for(const r of CITY_BUSINESS_SIGN_REFERENCES){
  const uses=signs.filter(s=>signReferenceFor(s.name)?.id===r.id);assert.ok(uses.length>0,r.id);placements+=uses.length;
  const m=manifest.find(s=>s.id===r.id);assert.ok(m);assert.equal(r.source,m.referencePage);assert.equal(r.logo.split('/').at(-1),m.file);
  const b=await readFile(new URL('../webapp/public'+r.logo,import.meta.url));bytes+=b.length;
  assert.equal(createHash('sha256').update(b).digest('hex'),m.sha256);assert.equal(b.subarray(1,4).toString(),'PNG');
  assert.ok(b.readUInt32BE(16)<=256&&b.readUInt32BE(20)<=128);assert.match(m.sourceUrl,/^https:\/\//);assert.match(m.usage,/not CC0/);
 }
 assert.equal(placements,67);assert.ok(bytes<150000);console.log('City expansion artwork bytes / placements',bytes,placements);
 const allCount=signs.filter(s=>signReferenceFor(s.name)).length;assert.equal(allCount,376);
 for(const name of ['Starlight Hotel','Diamond Coffee','Diamond Dental','Bar Ilirian','Oz Lighting Studio by deluxe','One Hotel','Residence Inn by Marriott','ALDI','Supermarket Xhangolli','KMY'])assert.equal(signReferenceFor(name),undefined,name);
 assert.equal(signReferenceFor('  MÔNCAFÉ BOUTIQUE HOTEL & SPA ').id,'moncafe');assert.equal(signReferenceFor('Residence Inn Hotel').id,'residence-inn');
});

test('13 facade interpretations retain footprints and bounded, finite merged geometry',()=>{
 const ids=Object.keys(CITY_BUSINESS_BUILDING_PROFILES);assert.equal(ids.length,13);
 const layer=new api.ReferenceFacades(WORLD,new Set(ids));assert.equal(layer.group.children.length,13);
 let triangles=0,draws=0;
 for(const id of ids){
  const profile=CITY_BUSINESS_BUILDING_PROFILES[id],building=WORLD.buildings.find(b=>b.id===id);
  assert.ok(building);assert.equal(NEIGHBOURHOOD_REFERENCE_PROFILES[id],profile);assert.match(profile.referenceImage,/^https:\/\//);assert.match(profile.features,/estimate|retained|survey|interpreted/i);
  assert.ok(BUSINESS_SIGNS.some(s=>s.buildingId===id));
 }
 layer.group.traverse(o=>{if(o.isMesh){draws++;const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');triangles+=(o.geometry.index?.count||p.count)/3;for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+n.getX(i)+n.getY(i)+n.getZ(i)));assert.ok(p.getY(i)>=-.01);}}});
 console.log('City facade triangles / draws',triangles,draws);assert.ok(triangles>3000&&triangles<30000);assert.ok(draws<=90);
 layer.update({x:1e5,z:1e5},false);assert.ok(layer.group.children.every(g=>!g.visible));
 layer.update({x:310,z:-652},true);assert.ok(layer.group.children.some(g=>g.visible));
 layer.dispose();assert.equal(layer.group.children.length,0);
});

test('eight height corrections propagate to the world and business mounts',()=>{
 assert.equal(Object.keys(CITY_BUSINESS_OBSERVED_HEIGHTS).length,8);
 for(const [id,correction] of Object.entries(CITY_BUSINESS_OBSERVED_HEIGHTS)){
  const b=WORLD.buildings.find(b=>b.id===id);assert.equal(b.h,correction.height);assert.equal(b.h,CITY_BUSINESS_BUILDING_PROFILES[id].height);
  assert.equal(b.originalHeight,3.2);assert.match(b.heightBasis,/estimated/);
  for(const s of BUSINESS_SIGNS.filter(s=>s.buildingId===id)){assert.deepEqual(s.footprint,b.p);assert.ok(s.mountHeight+s.signHeight/2<=b.h);}
 }
});

test('shared-block hotel details are clipped to the tenant radius',()=>{
 const profile=CITY_BUSINESS_BUILDING_PROFILES['396414953'];const centre=profile.detailAnchor;
 const edge={a:[centre[0]-60,centre[1]],b:[centre[0]+60,centre[1]],ux:1,uz:0,nx:0,nz:1,length:120,yaw:0};
 const detailed=[];api.cityBusinessDetails({...profile,front:[0,1]},[edge],12.8,()=>{},(e,color,u,y,w,h,d)=>{if(d>.2)detailed.push([e.a[0]+u-w/2,e.a[0]+u+w/2]);});
 assert.ok(detailed.length>0);for(const [lo,hi] of detailed){assert.ok(lo>=centre[0]-32-.01);assert.ok(hi<=centre[0]+32+.01);}
});

test('decoded artwork shares in-flight loads and caps concurrency plus LRU retention',async()=>{
 const images=[];const cache=api.createBrandArtworkCache(2,2,()=>{const image={naturalWidth:100,naturalHeight:50};images.push(image);return image;});
 const a=cache.load('a'),duplicate=cache.load('a'),b=cache.load('b'),c=cache.load('c');assert.equal(a,duplicate);
 assert.deepEqual(cache.stats(),{active:2,queued:1,cached:0});assert.equal(images.length,2);
 images[0].onload();assert.equal(await a,images[0]);assert.equal(images.length,3);assert.equal(images[2].src,'c');
 images[1].onload();await b;assert.equal(await cache.load('a'),images[0]); // a becomes the most recently used.
 images[2].onload();await c;assert.deepEqual(cache.stats(),{active:0,queued:0,cached:2});
 assert.equal(await cache.load('a'),images[0]);const reloaded=cache.load('b');assert.equal(images.length,4);images[3].onload();await reloaded;
 assert.deepEqual(cache.stats(),{active:0,queued:0,cached:2});
});

test('failed artwork leaves text fallback available and releases the next queued request',async()=>{
 const images=[];const cache=api.createBrandArtworkCache(1,2,()=>{const image={naturalWidth:0,naturalHeight:0};images.push(image);return image;});
 const first=cache.load('failed'),next=cache.load('next');images[0].onerror();assert.equal(await first,null);assert.equal(images[1].src,'next');
 images[1].onload();assert.equal(await next,null);assert.deepEqual(cache.stats(),{active:0,queued:0,cached:0});
 const retry=cache.load('failed');assert.equal(images.length,3);images[2].naturalWidth=80;images[2].naturalHeight=20;images[2].onload();assert.equal(await retry,images[2]);
});
