import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {facadeUv,applyFacadeFinish} from './facadeFinish.mjs';

test('texture projection changes only UVs; 4 metre repeats vertically',()=>{
 const mesh=new T.BoxGeometry(4,4,4);
 const position=Array.from(mesh.attributes.position.array), normal=Array.from(mesh.attributes.normal.array), indices=Array.from(mesh.index.array);
 assert.equal(facadeUv(mesh),mesh);
 assert.deepEqual(Array.from(mesh.attributes.position.array),position);
 assert.deepEqual(Array.from(mesh.attributes.normal.array),normal);
 assert.deepEqual(Array.from(mesh.index.array),indices);
 for(let i=0;i<mesh.attributes.uv.count;i++)if(mesh.attributes.normal.getY(i)===0)
   assert.equal(mesh.attributes.uv.getY(i),mesh.attributes.position.getY(i)/4);
});

test('finish marks eligible walls only and cleanly restores palette',()=>{
 const map=new T.Texture(), object=new T.Group();
 const facade=new T.MeshStandardMaterial(), landmark=new T.MeshStandardMaterial();
 facade.userData.plasterFacade=true;
 object.add(new T.Mesh(new T.BoxGeometry(),facade),new T.Mesh(new T.BoxGeometry(),landmark));
 applyFacadeFinish(object,map);
 assert.equal(facade.map,map);assert.equal(landmark.map,null);
 applyFacadeFinish(object,null);
 assert.equal(facade.map,null);assert.equal(landmark.map,null);
});

test('budgeted exact preview image',()=>{
 const b=readFileSync(new URL('../../../public/assets/tirana-city-game/wall-plaster-512.webp',import.meta.url));
 assert.equal(b.toString('ascii',8,12),'WEBP');
 assert.ok(b.length<64_000);
 assert.equal(createHash('sha256').update(b).digest('hex'),'c922b38204ccf7dc74e2b8c39ef6e527481f0e1fbabdfffcf9107ababf918739');
});
