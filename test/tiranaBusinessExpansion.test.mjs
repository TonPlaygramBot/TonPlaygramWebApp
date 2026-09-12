import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import polygonClipping from '../webapp/node_modules/polygon-clipping/dist/polygon-clipping.esm.js';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {BUSINESS_SITES} from '../webapp/src/games/tirana-city-source/businessSites.mjs';
import {BUSINESS_SIGNS} from '../webapp/src/games/tirana-city-source/businessSignRegistry.mjs';
import {BUSINESS_BUILDING_PROFILES,BUSINESS_BUILDING_PARTS} from '../webapp/src/games/tirana-city-source/businessBuildingProfiles.mjs';
import {BUSINESS_SIGN_REFERENCES} from '../webapp/src/games/tirana-street-life/businessSignReferences.mjs';
import {signReferenceFor} from '../webapp/src/games/tirana-street-life/signReferences.mjs';
import {STREET_LIFE} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
const dir=await mkdtemp(join(tmpdir(),'tirana-business-'));let api;
try{const file=join(dir,'api.mjs');await build({stdin:{contents:`export * as T from 'three';export {ReferenceFacades} from './src/games/tirana-city-source/ReferenceFacades';export {BuildingBrandLayer} from './src/games/tirana-city-source/BuildingBrandLayer';export {StreetLifeLayer} from './src/games/tirana-street-life/StreetLifeLayer';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}

test('all 27 new brands have packaged, bounded, checksum-verified original artwork and mapped uses',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../webapp/public/assets/tirana-streets/signs/business-sources.json',import.meta.url)));
 assert.equal(manifest.length,27);assert.equal(BUSINESS_SIGN_REFERENCES.length,27);
 const used=new Set([...BUSINESS_SIGNS,...STREET_LIFE.storefronts,...NEIGHBOURHOOD.storefronts].map(s=>signReferenceFor(s.name)?.id));
 let bytes=0;for(const r of BUSINESS_SIGN_REFERENCES){assert.ok(used.has(r.id),r.id);const m=manifest.find(m=>m.id===r.id);assert.ok(m);assert.equal(r.logo.split('/').at(-1),m.file);const data=await readFile(new URL('../webapp/public'+r.logo,import.meta.url));bytes+=data.length;assert.equal(createHash('sha256').update(data).digest('hex'),m.sha256);assert.equal(data.subarray(1,4).toString(),'PNG');assert.ok(data.readUInt32BE(16)<=512&&data.readUInt32BE(20)<=256);assert.match(m.sourceUrl,/^https:\/\//);assert.match(m.usage,/not CC0/);}
 assert.ok(bytes<400000);console.log('New logo bytes',bytes);
 for(const name of ['Bank','Hotel','Market','Sophie Apartments','KFC Property','Hotel Dinasty Neighbour','Union Hotel'])assert.equal(signReferenceFor(name),undefined,name);
 assert.equal(signReferenceFor('  HÔTEL ÉLYSÉE  ').id,'elysee');assert.equal(signReferenceFor('Banka Kombëtare Tregtare').id,'bkt');
});

test('businesses keep source identities, real footprints, in-wall-height mounts and separate shared-facade boards',()=>{
 assert.equal(BUSINESS_SITES.sites.length,402);assert.equal(new Set(BUSINESS_SIGNS.map(s=>s.id)).size,BUSINESS_SIGNS.length);
 const buildings=new Map(WORLD.buildings.map(b=>[b.id,b]));
 for(const s of BUSINESS_SITES.sites){const b=buildings.get(s.buildingId);assert.ok(b);assert.deepEqual(s.footprint,b.p);assert.ok(s.sourceId&&s.tags.name);assert.equal(s.name,s.tags.name);assert.ok(s.mountHeight+s.signHeight/2<=b.h+.01);assert.ok(s.mountHeight-s.signHeight/2>0);assert.ok(s.width>0);}
 for(const group of Map.groupBy(BUSINESS_SITES.sites,s=>s.buildingId).values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const a=group[i],b=group[j],dx=a.x-b.x,dz=a.z-b.z,nx=Math.sin(a.yaw),nz=Math.cos(a.yaw);
  if(Math.cos(a.yaw-b.yaw)<.99||Math.abs(dx*nx+dz*nz)>.1)continue;
  assert.ok(Math.abs(dx*nz-dz*nx)>(a.width+b.width)/2||Math.abs(a.mountHeight-b.mountHeight)>(a.signHeight+b.signHeight)/2,`${a.name} overlaps ${b.name}`);
 }
});

test('eight upgraded buildings and authored tower have finite, bounded merged geometry',()=>{
 const layer=new api.ReferenceFacades(WORLD,new Set(Object.keys(BUSINESS_BUILDING_PROFILES)));assert.equal(layer.group.children.length,9);let triangles=0,draws=0;
 layer.group.traverse(o=>{if(o.isMesh){draws++;const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');triangles+=(o.geometry.index?.count||p.count)/3;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+n.getX(i)+n.getY(i)+n.getZ(i)));}});
 assert.ok(triangles>2000&&triangles<25000);assert.ok(draws<=60);console.log('Business facade triangles/draws',triangles,draws);
 layer.update({x:1e5,z:1e5},true);assert.ok(layer.group.children.every(g=>!g.visible));layer.update({x:-1350,z:85},false);assert.ok(layer.group.children.some(g=>g.visible));layer.dispose();assert.equal(layer.group.children.length,0);
});

test('height corrections agree with colliders and the rear tower adds no new ground footprint',()=>{
 for(const id of ['196893237','400647876']){const b=WORLD.buildings.find(b=>b.id===id);assert.equal(b.h,BUSINESS_BUILDING_PROFILES[id].height);assert.ok(b.originalHeight<b.h);assert.match(b.heightBasis,/estimated/);}
 for(const part of BUSINESS_BUILDING_PARTS){const parent=WORLD.buildings.find(b=>b.id===part.parentBuildingId);assert.ok(parent);assert.equal(polygonClipping.difference([part.p],[parent.p]).length,0);assert.equal(WORLD.buildings.find(b=>b.id===part.id).h,BUSINESS_BUILDING_PROFILES[part.id].height);assert.match(part.id,/^visual-part\//);assert.ok(!BUSINESS_SIGNS.some(s=>s.buildingId===part.id));}
});

test('bank/hotel atlas stays below 4096 and visible identity draws remain bounded',()=>{
 const oldDocument=globalThis.document,oldImage=globalThis.Image,canvases=[],images=[],draws=[];
 const ctx=new Proxy({measureText:s=>({width:s.length*7}),drawImage:(...args)=>draws.push(args)},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.document={createElement:()=>{const c={width:0,height:0,getContext:()=>ctx};canvases.push(c);return c;}};
 globalThis.Image=class {naturalWidth=256;naturalHeight=128;set src(value){this.url=value;images.push(this);}};
 let layer;try{layer=new api.BuildingBrandLayer();assert.ok(canvases[0].width<=4096&&canvases[0].height<=4096);assert.equal(new Set(images.map(i=>i.url)).size,images.length);assert.ok(images.length>=20&&images.length<=31);images.forEach(i=>i.onload());assert.ok(draws.length>=images.length&&draws.length<BUSINESS_SIGNS.length);
  const site=BUSINESS_SIGNS.find(s=>s.name==='Hotel Mondial');layer.update(1,site,false,true);const mesh=layer.group.children.find(o=>o.isInstancedMesh);assert.ok(mesh.count>0&&mesh.count<=48);const uv=mesh.geometry.getAttribute('instanceAtlas');for(let i=0;i<mesh.count;i++){assert.ok(uv.getX(i)>=0&&uv.getY(i)>=0);assert.ok(uv.getX(i)+uv.getZ(i)<=1&&uv.getY(i)+uv.getW(i)<=1);}
  layer.dispose();const count=draws.length;images.forEach(i=>i.onload());assert.equal(draws.length,count);console.log('Business atlas',canvases[0].width,canvases[0].height);
 }finally{layer?.dispose();globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
