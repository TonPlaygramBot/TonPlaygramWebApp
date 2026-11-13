import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../webapp/public/assets/tirana-streets/city-realism/',import.meta.url);
const bytes=readFileSync(new URL('urban-tree.glb',root));
const receipt=JSON.parse(readFileSync(new URL('provenance.json',root)));
const jsonSize=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonSize));
const bin=bytes.subarray(28+jsonSize);
test('licensed local tree matches its receipt and has no remote runtime dependencies',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.derived.sha256);
 assert.equal(receipt.license,'CC0-1.0');assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.ok(bytes.length<4*1024*1024);assert.equal(gltf.buffers.length,1);assert.equal(gltf.buffers[0].uri,undefined);
 assert.ok(gltf.images.every(i=>Number.isInteger(i.bufferView)&&!i.uri));
 for(const view of gltf.bufferViews)assert.ok((view.byteOffset||0)+view.byteLength<=bin.length);
});
test('tree retains UVs, normals, PBR textures and a bounded triangle/material budget',()=>{
 let triangles=0;for(const mesh of gltf.meshes)for(const p of mesh.primitives){assert.ok(Number.isInteger(p.attributes.NORMAL));assert.ok(Number.isInteger(p.attributes.TEXCOORD_0));triangles+=gltf.accessors[p.indices].count/3;}
 assert.ok(triangles<=36000);assert.equal(gltf.materials.length,3);
 assert.ok(gltf.materials.every(m=>m.pbrMetallicRoughness.baseColorTexture&&m.normalTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture));
 assert.equal(triangles,receipt.derived.stats.parts.reduce((n,p)=>n+p.triangles,0));
});
test('foliage alpha is embedded PNG, double-sided and alpha-tested rather than sorted transparency',()=>{
 const material=gltf.materials.find(m=>m.alphaMode==='MASK');assert.ok(material);assert.equal(material.doubleSided,true);assert.ok(material.alphaCutoff>0&&material.alphaCutoff<1);
 const image=gltf.images[gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index].source];assert.equal(image.mimeType,'image/png');const view=gltf.bufferViews[image.bufferView],png=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.readUInt32BE(16)<=512);assert.ok(png.readUInt32BE(20)<=512);assert.equal(png[25],6,'RGBA must retain real leaf alpha');
});
