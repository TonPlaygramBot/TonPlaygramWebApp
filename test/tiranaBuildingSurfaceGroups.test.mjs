import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {mergeGeometries} from '../webapp/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {assignBuildingSurfaceGroups} from '../webapp/src/games/tirana-environment/buildingSurfaceGroups.mjs';
import {buildingSurfaceUV} from '../webapp/src/games/tirana-environment/buildingSurfaceUV.mjs';

for (const indexed of [false,true]) test(`roof/wall material groups preserve triangles and positions (indexed=${indexed})`,()=>{
  const a=new T.ExtrudeGeometry(new T.Shape([[0,0],[8,0],[8,-6],[3,-3],[0,-6]].map(p=>new T.Vector2(...p))),{depth:12,bevelEnabled:false}).rotateX(-Math.PI/2);
  const b=a.clone().translate(20,0,0);
  const g=mergeGeometries([a,b],false),pos=g.getAttribute('position');
  if(indexed)g.setIndex(Array.from({length:pos.count},(_,i)=>i));
  const before=Array.from(pos.array),count=pos.count;
  assignBuildingSurfaceGroups(g);
  assert.deepEqual(Array.from(pos.array),before);
  assert.equal(g.index.count,count);
  assert.equal(new Set(g.index.array).size,count);
  assert.equal(g.groups.length,2);
  assert.deepEqual(g.groups.map(x=>x.materialIndex),[0,1]);
  for(const group of g.groups) for(let i=group.start;i<group.start+group.count;i++){
    const roof=Math.abs(g.getAttribute('normal').getY(g.index.getX(i)))>.5;
    assert.equal(roof,group.materialIndex===1);
  }
  assignBuildingSurfaceGroups(g);
  assert.equal(g.index.count,count); // Repeated grouping does not duplicate faces.
  a.dispose();b.dispose();g.dispose();
});
test('plaster uses its source 2.2m width while cap mapping remains independent',()=>{
  assert.deepEqual(buildingSurfaceUV(0,2.2,2.2,1,0,0,2.2),[1,1]);
  assert.deepEqual(buildingSurfaceUV(4,12,4,0,1,0,4),[1,1]);
});
test('reused concrete roof maps match the CC0 provenance manifest',async()=>{
  const {readFileSync}=await import('node:fs');
  const {createHash}=await import('node:crypto');
  const base=new URL('../webapp/public/assets/tirana-streets/environment/',import.meta.url);
  const records=JSON.parse(readFileSync(new URL('sources.json',base),'utf8')).filter(s=>s.asset==='rough_concrete');
  assert.equal(records.length,3);
  for(const record of records){
    assert.equal(record.license,'CC0-1.0');
    assert.equal(createHash('sha256').update(readFileSync(new URL(record.file,base))).digest('hex'),record.sha256);
  }
});
