import {inflateSync} from 'node:zlib';
import test from 'node:test';import assert from 'node:assert/strict';

import {project,unproject,civicSites,referenceLinks,cablePath,cablePose,mountainHeight,REFERENCES} from '../webapp/src/games/tirana-expansion/geography.mjs';
import {ASSET_IDS,buildGltfAsset,assetParts} from '../webapp/src/games/tirana-expansion/gltfAssets.mjs';
const origin=[41.3275,19.8188];

test('geographic transforms round-trip central city and Dajti exactly',()=>{for(const p of [{latitude:41.32,longitude:19.81},...Object.values(REFERENCES)]){const q=unproject(origin,project(origin,p.latitude,p.longitude));assert.ok(Math.abs(q.latitude-p.latitude)<1e-10);assert.ok(Math.abs(q.longitude-p.longitude)<1e-10);}});
test('satellite and Street View links do not copy any image bytes',()=>{const links=referenceLinks(origin,{x:0,z:0});assert.ok(links.satellite.includes('basemap=satellite'));assert.ok(links.streetView.includes('map_action=pano'));assert.ok(links.satellite.includes('41.3275000,19.8188000'));});
test('exact civic OSM IDs, never nearby name guesses or origin relocation',()=>{const world={buildings:[{id:'1249637844',p:[[2,4],[10,4],[10,12],[2,12]],h:18},{id:'unrelated',name:'Palace of Culture',p:[[0,0],[1,0],[1,1]]}]};const copy=structuredClone(world),sites=civicSites(world);assert.equal(sites.length,1);assert.equal(sites[0].x,6);assert.equal(sites[0].z,8);assert.deepEqual(world,copy);});
test('Dajti is geographically outside the old district, not scaled into it',()=>{const p=project(origin,REFERENCES.upper.latitude,REFERENCES.upper.longitude);assert.ok(p.x>7000&&p.z< -4000);});
test('cable endpoints correspond to mapped terminal points; both lanes separate',()=>{const path=cablePath(origin),lower=project(origin,REFERENCES.lower.latitude,REFERENCES.lower.longitude),upper=project(origin,REFERENCES.upper.latitude,REFERENCES.upper.longitude);for(const key of ['x','z']){assert.equal(path[0][key],lower[key]);assert.ok(Math.abs(path.at(-1)[key]-upper[key])<1e-8);}const a=cablePose(path,.4),b=cablePose(path,.6,true);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-4.2)<1e-8);});
test('cable poses remain finite and clamp at each terminus',()=>{const path=cablePath(origin);assert.deepEqual(cablePose(path,-1),cablePose(path,0));assert.deepEqual(cablePose(path,2),cablePose(path,1));for(let i=0;i<=100;i++)assert.ok(Object.values(cablePose(path,i/100)).every(Number.isFinite));assert.throws(()=>cablePath(origin,1));});
test('authored mountain relief stays finite; not reported as a DEM',()=>{for(let x=0;x<14000;x+=400)for(let z=-10000;z<1000;z+=700){const h=mountainHeight(x,z,origin);assert.ok(Number.isFinite(h)&&h>0&&h<1700);}});
for(const id of ASSET_IDS)test(`${id}: glTF 2.0 with finite transforms, embedded geometry and PBR materials`,()=>{
 const g=buildGltfAsset(id);assert.equal(g.asset.version,'2.0');assert.ok(g.nodes.length>5);assert.ok(g.materials.every(m=>m.pbrMetallicRoughness));assert.ok(g.buffers[0].uri.startsWith('data:'));const bytes=Buffer.from(g.buffers[0].uri.split(',')[1],'base64');assert.equal(bytes.length,g.buffers[0].byteLength);
 for(const view of g.bufferViews){assert.equal(view.byteOffset%4,0);assert.ok(view.byteOffset+view.byteLength<=bytes.length);}
 for(const node of g.nodes){assert.ok(node.translation.every(Number.isFinite));assert.ok(node.scale.every(v=>Number.isFinite(v)&&v>0));assert.ok(Math.abs(Math.hypot(...node.rotation)-1)<1e-7);}
 for(const image of g.images)assert.ok(image.uri.startsWith('data:image/png;base64,'));
 for(const mesh of g.meshes)for(const prim of mesh.primitives){const p=g.accessors[prim.attributes.POSITION],n=g.accessors[prim.attributes.NORMAL],idx=g.accessors[prim.indices],iv=g.bufferViews[idx.bufferView];assert.equal(p.count,n.count);assert.equal(idx.count%3,0);for(let i=0;i<idx.count;i++)assert.ok(bytes.readUInt16LE(iv.byteOffset+i*2)<p.count);}
 assert.deepEqual(buildGltfAsset(id),g);
});
test('unknown asset IDs cannot silently load unrelated content',()=>{assert.throws(()=>assetParts('google-earth-download'));});

test('authored terrain seats both terminal platforms and clears every cable span',()=>{const path=cablePath(origin);for(const p of path){const gap=p.y-mountainHeight(p.x,p.z,origin);assert.ok(gap>=5.999&&gap<=32.001);}for(const p of [path[0],path.at(-1)])assert.ok(Math.abs(p.y-6-mountainHeight(p.x,p.z,origin))<1e-7);});
test('gondola uses transparent PBR glazing for an in-cabin view',()=>{const g=buildGltfAsset('gondola'),glass=g.materials.find(m=>m.name==='glass');assert.equal(glass.alphaMode,'BLEND');assert.ok(glass.pbrMetallicRoughness.baseColorFactor[3]<.5);});

test('all embedded PBR PNG textures decode to 32 by 32 RGB scanlines',()=>{const seen=new Set();for(const id of ASSET_IDS)for(const image of buildGltfAsset(id).images){if(seen.has(image.uri))continue;seen.add(image.uri);const b=Buffer.from(image.uri.split(',')[1],'base64');assert.equal(b.subarray(1,4).toString(),'PNG');const compressed=[];for(let offset=8;offset<b.length;){const length=b.readUInt32BE(offset),type=b.subarray(offset+4,offset+8).toString(),payload=b.subarray(offset+8,offset+8+length);if(type==='IHDR'){assert.equal(payload.readUInt32BE(0),32);assert.equal(payload.readUInt32BE(4),32);assert.equal(payload[9],2);}if(type==='IDAT')compressed.push(payload);offset+=12+length;}const pixels=inflateSync(Buffer.concat(compressed));assert.equal(pixels.length,32*97);for(let y=0;y<32;y++)assert.equal(pixels[y*97],0);}assert.equal(seen.size,3);});
