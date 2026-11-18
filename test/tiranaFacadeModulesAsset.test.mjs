import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('../webapp/public/assets/tirana-streets/facade-modules/',import.meta.url);
const bytes=readFileSync(new URL('facade-modules.glb',base));
const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const modules=JSON.parse(readFileSync(new URL('modules.json',base)));
test('real GLB matches acquired CC0 derivative and has no external dependencies',()=>{
 const source=JSON.parse(readFileSync(new URL('sources.json',base)));
 assert.equal(source.license,'CC0-1.0');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),source.derivative.sha256);
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.ok(bytes.length<8*1024*1024);
 assert.ok(json.buffers.every(b=>!b.uri));assert.ok(json.images.every(i=>i.bufferView!==undefined&&!i.uri));
});
test('all four bounded bays retain UV-mapped original PBR materials and correct normalized bounds',()=>{
 assert.equal(modules.length,4);
 for(const module of modules){
  const parent=json.nodes.find(n=>n.name===module.name);assert.ok(parent);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let tris=0;
  for(const child of parent.children){const node=json.nodes[child];assert.ok(!node.matrix&&!node.rotation&&!node.translation&&!node.scale);
   for(const p of json.meshes[node.mesh].primitives){
    assert.ok(p.attributes.TEXCOORD_0!==undefined);assert.ok(p.attributes.NORMAL!==undefined);
    const position=json.accessors[p.attributes.POSITION];for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],position.min[i]);hi[i]=Math.max(hi[i],position.max[i]);}
    tris+=json.accessors[p.indices].count/3;
    const m=json.materials[p.material];assert.ok(m.pbrMetallicRoughness.baseColorTexture);assert.ok(m.normalTexture);assert.ok(m.name.startsWith('modular_urban_apartments_facade_'));
   }
  }
  assert.equal(tris,module.triangles);assert.ok(tris<1500);
  assert.ok(Math.abs(lo[0]+1.5)<.001&&Math.abs(hi[0]-1.5)<.001);
  assert.ok(Math.abs(lo[1])<.001&&Math.abs(hi[1]-3)<.001);
  assert.ok(hi[2]>.02&&hi[2]<.5);assert.ok(lo[2]>-.5);
 }
});
