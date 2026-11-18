import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../webapp/public/assets/tirana-streets/city-realism/',import.meta.url);
function load(name){const bytes=readFileSync(new URL(name,root));const n=bytes.readUInt32LE(12);return {bytes,json:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n)};}
const original=load('urban-tree.glb'),lod=load('urban-tree-lod1.glb');
test('medium tree remains under20k triangles/3MB with checked CC0 lineage',()=>{
 const p=JSON.parse(readFileSync(new URL('urban-tree-lod1-provenance.json',root)));
 assert.equal(p.license,'CC0-1.0');
 assert.equal(createHash('sha256').update(original.bytes).digest('hex'),p.sourceSha256);
 assert.equal(createHash('sha256').update(lod.bytes).digest('hex'),p.sha256);
 const tris=lod.json.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+lod.json.accessors[p.indices].count/3,0),0);
 assert.equal(tris,p.triangles);assert.ok(tris<20000);assert.ok(lod.bytes.length<3e6);
 for(const m of lod.json.meshes)for(const p of m.primitives){assert.ok(p.attributes.TEXCOORD_0!==undefined);assert.ok(p.attributes.NORMAL!==undefined);}
});
test('leaf alpha, shared-source PBR and branch texture transform survive export',()=>{
 for(const m of lod.json.materials){
  const source=original.json.materials.find(s=>s.name===m.name);assert.ok(source);
  assert.ok(m.normalTexture);assert.ok(m.pbrMetallicRoughness.baseColorTexture);assert.ok(m.pbrMetallicRoughness.metallicRoughnessTexture);
  assert.deepEqual(m.normalTexture.extensions,source.normalTexture.extensions);
 }
 const leaf=lod.json.materials.find(m=>m.name.endsWith('_leaves'));
 assert.equal(leaf.alphaMode,'MASK');assert.ok(Math.abs(leaf.alphaCutoff-.45)<1e-6);assert.equal(leaf.doubleSided,true);
 const texture=lod.json.textures[leaf.pbrMetallicRoughness.baseColorTexture.index];const image=lod.json.images[texture.source];
 assert.equal(image.mimeType,'image/png');const view=lod.json.bufferViews[image.bufferView];const png=lod.bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png[25],6); // RGBA not an opaque RGB export.
 assert.ok(png.readUInt32BE(16)<=512&&png.readUInt32BE(20)<=512);
});
