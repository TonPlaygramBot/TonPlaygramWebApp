import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {NEIGHBOURHOOD} from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import {NEIGHBOURHOOD_CANOPY} from '../webapp/src/games/tirana-street-life/neighbourhoodCanopy.mjs';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import {CITY_PLACES} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {EDUCATION_SITES} from '../webapp/src/games/tirana-city-source/educationSites.mjs';
import {inside,bounds,distance,spatialIndex} from '../webapp/src/games/tirana-city-completion/placementCore.mjs';
import {canopyCandidates,vegetationKind} from '../webapp/src/games/tirana-street-life/neighbourhoodCanopyCore.mjs';
import {NEIGHBOURHOOD_REFERENCE_PROFILES} from '../webapp/src/games/tirana-city-source/neighbourhoodProfiles.mjs';
const dir=await mkdtemp(join(tmpdir(),'tirana-realism-'));let api;
try{const file=join(dir,'api.mjs');await build({stdin:{contents:`export * as T from 'three';export {InstitutionLayer} from './src/games/tirana-city-source/InstitutionLayer';export {StreetLifeLayer} from './src/games/tirana-street-life/StreetLifeLayer';export {ReferenceFacades} from './src/games/tirana-city-source/ReferenceFacades';export {sourceBuildingColour,firstWindowHeight} from './src/games/tirana-neighbourhood/buildingAppearance';`,resolveDir:new URL('../webapp/',import.meta.url).pathname,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:file});api=await import(pathToFileURL(file));}finally{await rm(dir,{recursive:true,force:true});}
test('new canopy stays in mapped vegetation, outside paths and building walls',()=>{
 const features=new Map(NEIGHBOURHOOD.polygonFeatures.map(f=>[f.id,f]));const roads=spatialIndex(WORLD.roads.filter(r=>!r.tunnel),r=>{let b=bounds([r.a,r.b]),p=r.w/2+2;return[b[0]-p,b[1]-p,b[2]+p,b[3]+p];});const buildings=spatialIndex(WORLD.buildings,b=>bounds(b.p));
 assert.ok(NEIGHBOURHOOD_CANOPY.trees.length>1500);assert.equal(NEIGHBOURHOOD_CANOPY.source.satelliteVerified,false);
 assert.equal(new Set(CANOPY_TREES.map(t=>t.id)).size,CANOPY_TREES.length);
 for(const t of NEIGHBOURHOOD_CANOPY.trees){const f=features.get(t.sourceId);assert.ok(f&&inside(t.x,t.z,f.p,f.holes));assert.ok(!roads(t.x,t.z).some(r=>distance([t.x,t.z],r.a,r.b)<r.w/2+1));assert.ok(!buildings(t.x,t.z).some(b=>inside(t.x,t.z,b.p,b.holes)));}
});
test('vegetation cannot fill courts, pitches, construction or plain grass',()=>{
 for(const tags of [{sport:'soccer',leisure:'park'},{landuse:'construction',leisure:'garden'},{landuse:'grass'},{building:'yes',natural:'wood'}])assert.equal(vegetationKind(tags),null);
 const f={id:'park',p:[[0,0],[100,0],[100,100],[0,100]],holes:[[[20,20],[80,20],[80,80],[20,80]]],tags:{leisure:'park'}};const a=[...canopyCandidates(f)];assert.deepEqual(a,[...canopyCandidates(f)]);for(const p of a)assert.ok(inside(p.x,p.z,f.p,f.holes));
});
test('education signs retain actual individual footprints, names and private/public flag distinction',()=>{
 assert.ok(EDUCATION_SITES.length>300);for(const s of EDUCATION_SITES){const b=WORLD.buildings.find(b=>b.id===s.buildingId);assert.ok(b);assert.deepEqual(s.footprint,b.p);if(!['government','public'].includes(s.tags['operator:type']))assert.equal(s.country,null);}
 const sami=EDUCATION_SITES.find(s=>s.buildingId==='relation/14761294');assert.match(sami.name,/Sami/);assert.equal(sami.country,'AL');
 const servete=EDUCATION_SITES.find(s=>s.buildingId==='731114346');assert.match(servete.name,/Servete/);assert.equal(servete.height,10.8);
});
test('flag readiness is per country, double sided and visible without a network asset path',async()=>{
 const {T,InstitutionLayer}=api;const oldDocument=globalThis.document,oldLoad=T.TextureLoader.prototype.load;const ctx=new Proxy({measureText:s=>({width:s.length*7})},{get:(o,k)=>o[k]||(()=>{})});globalThis.document={createElement:()=>({getContext:()=>ctx})};const pending=[];
 T.TextureLoader.prototype.load=function(url,onLoad){pending.push({url,onLoad});return new T.Texture();};
 const mk=(id,country)=>({id,name:id,category:'school',country,buildingId:id,footprint:[[0,0],[20,0],[20,20],[0,20]],height:10,x:10,z:10,tags:{},anchor:[0,10]});
 let layer;
 try{layer=new InstitutionLayer([mk('school-al','AL'),mk('embassy-us','US')]);assert.equal(pending.length,2);assert.ok(pending.every(p=>p.url.startsWith('data:image/svg+xml;base64,')));
 pending[0].onLoad(new T.Texture());await Promise.resolve();layer.update(1,{x:0,z:0});let al;layer.group.traverse(o=>{if(o.name==='AL flag')al=o;});assert.equal(al.visible,true);assert.equal(al.material.side,T.DoubleSide);assert.ok(al.position.z>1.5);assert.ok(al.parent.visible);
 pending[1].onLoad(new T.Texture());await layer.ready;
 }finally{layer?.dispose();T.TextureLoader.prototype.load=oldLoad;globalThis.document=oldDocument;}
});
test('source-specific models retain the school courtyard and agree with collision height',()=>{
 const {T,ReferenceFacades}=api;const ids=new Set(['relation/14761294','731114346','885643064','885643065','885643063']);const layer=new ReferenceFacades(WORLD,ids);assert.equal(layer.group.children.length,5);layer.group.updateMatrixWorld(true);
 let triangles=0;layer.group.traverse(o=>{if(o.isMesh){const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count||p.count)/3;for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));}});assert.ok(triangles<65000);
 const b=WORLD.buildings.find(b=>b.id==='relation/14761294'),hole=b.holes[0],x=hole.reduce((s,p)=>s+p[0],0)/hole.length,z=hole.reduce((s,p)=>s+p[1],0)/hole.length;
 assert.equal(new T.Raycaster(new T.Vector3(x,100,z),new T.Vector3(0,-1,0)).intersectObject(layer.group,true).length,0);
 const school=WORLD.buildings.find(b=>b.id==='731114346');assert.equal(school.h,NEIGHBOURHOOD_REFERENCE_PROFILES[school.id].height);assert.equal(school.originalHeight,3.2);layer.dispose();
});
test('source material/color survives every LOD and one-storey schools receive windows',()=>{
 const {sourceBuildingColour,firstWindowHeight}=api;assert.equal(sourceBuildingColour({tags:{'building:colour':'Gainsboro'}}).getHex(),0xdcdcdc);assert.equal(sourceBuildingColour({tags:{'building:colour':'#abc'}}).getHex(),0xaabbcc);assert.notEqual(sourceBuildingColour({id:'1',tags:{'building:material':'brick'}}).getHex(),sourceBuildingColour({id:'1'}).getHex());assert.ok(firstWindowHeight({h:3.2,tags:{building:'school'}})<2.2);assert.ok(firstWindowHeight({h:12,minHeight:5})>5);
});

test('all institution signs share an atlas within a 4096 pixel mobile texture limit',async()=>{
 const {T,InstitutionLayer}=api,oldDocument=globalThis.document,oldLoad=T.TextureLoader.prototype.load,canvases=[];const ctx=new Proxy({measureText:s=>({width:s.length*7})},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.document={createElement:()=>{const canvas={width:0,height:0,getContext:()=>ctx};canvases.push(canvas);return canvas;}};T.TextureLoader.prototype.load=function(url,onLoad){const t=new T.Texture();queueMicrotask(()=>onLoad(t));return t;};let layer;
 try{const start=performance.now();layer=new InstitutionLayer(CITY_PLACES.sites);await layer.ready;assert.ok(canvases[0].width<=4096&&canvases[0].height<=4096);assert.ok(layer.group.children.length>500);console.log('Institution startup CPU ms',Math.round(performance.now()-start),'atlas',canvases[0].width,canvases[0].height);}finally{layer?.dispose();globalThis.document=oldDocument;T.TextureLoader.prototype.load=oldLoad;}
});


test('all mapped neighbourhood business labels fit a mobile texture and bounded draw',()=>{
 const {StreetLifeLayer}=api,oldDocument=globalThis.document,oldImage=globalThis.Image,canvases=[];
 const ctx=new Proxy({measureText:s=>({width:s.length*7})},{get:(o,k)=>o[k]||(()=>{})});
 globalThis.document={createElement:()=>{const canvas={width:0,height:0,getContext:()=>ctx};canvases.push(canvas);return canvas;}};
 globalThis.Image=class {set src(value){}};let layer;
 try{layer=new StreetLifeLayer({storefronts:NEIGHBOURHOOD.storefronts,stops:[],fuel:[],advertising:[]},{},true);
  assert.ok(canvases[0].width<=4096&&canvases[0].height<=4096);assert.ok(canvases[0].height>0);
  const site=NEIGHBOURHOOD.storefronts[0];layer.update(1,{x:site.x,z:site.z},false,true);
  const mesh=layer.group.children.find(o=>o.isInstancedMesh);assert.ok(mesh.count>0&&mesh.count<=384);
  const uv=mesh.geometry.getAttribute('instanceAtlas');for(let i=0;i<mesh.count;i++){assert.ok(uv.getX(i)>=0&&uv.getY(i)>=0);assert.ok(uv.getX(i)+uv.getZ(i)<=1&&uv.getY(i)+uv.getW(i)<=1);}
 }finally{layer?.dispose();globalThis.document=oldDocument;globalThis.Image=oldImage;}
});
