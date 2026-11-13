import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {turiSurfaceSeams,repairTuriAtlasPixels,prepareTuriSurfaceContinuity} from '../webapp/src/games/tiranastreets/street-career/turiSurfaceContinuity.mjs';
import {weaponHandFrame} from '../webapp/src/games/tiranastreets/street-career/weaponPose.mjs';

function seamFixture() {
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute([0,0,0, 0,1,0, 1,0,0, 0,0,0, -1,0,0, 0,1,0],3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,.1,0,.995,.1,0,.995,.1,0,.995],3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute([.2,.2,.2,.8,.4,.2,.6,.2,.8,.2,.6,.8],2));
  return geometry;
}

test('stitched UV islands share exposure at the join without rewriting the source pixels or distant facial details',()=>{
  const geometry=seamFixture(),pixels=new Uint8ClampedArray(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=(y*64+x)*4,value=x>=12&&x<=26?100:x>=38&&x<=51?120:0;
    pixels.set([value,value,value,255],i);
  }
  const before=pixels.slice(),seams=turiSurfaceSeams(geometry);
  assert.equal(seams.edges.length,1);
  const repaired=repairTuriAtlasPixels(geometry,pixels,64,64,seams);
  assert.deepEqual(pixels,before,'original embedded atlas remains immutable');
  const sample=(x,y)=>repaired[(y*64+x)*4];
  assert.ok(Math.abs(sample(13,24)-sample(38,24))<12,'the two sides converge toward a common exposure');
  assert.ok(sample(10,24)>0,'empty gutter gains neighbouring skin instead of filtering to black');
  assert.equal(sample(22,24),100,'interior facial details outside the narrow seam band remain exact');
  assert.equal(sample(46,24),120,'a nearby other UV island is preserved');
  assert.equal(sample(0,0),0,'unrelated atlas background is not recoloured');
  for(let i=3;i<repaired.length;i+=4)assert.equal(repaired[i],255);
});

test('Turi seam preparation shares smooth normals while preserving geometry, non-Turi materials and ownership',()=>{
  const root=new T.Group(),geometry=seamFixture(),material=new T.MeshStandardMaterial();material.name='Turi multi-view head';
  const head=new T.Mesh(geometry,material),other=new T.Mesh(geometry,new T.MeshStandardMaterial());root.add(head,other);
  const positions=geometry.getAttribute('position').array.slice(),normals=geometry.getAttribute('normal').array.slice();
  const release=prepareTuriSurfaceContinuity(root),prepared=head.geometry;
  assert.notEqual(prepared,geometry);assert.equal(other.geometry,geometry);
  assert.deepEqual(prepared.getAttribute('position').array,positions);
  assert.deepEqual(geometry.getAttribute('normal').array,normals);
  assert.deepEqual(new T.Vector3().fromBufferAttribute(prepared.getAttribute('normal'),0),new T.Vector3().fromBufferAttribute(prepared.getAttribute('normal'),3));
  const live=new T.Group(),clone=head.clone();live.add(clone);let released=0;prepared.addEventListener('dispose',()=>released++);
  release(live);release(live);assert.equal(head.geometry,geometry);assert.equal(clone.geometry,geometry);assert.equal(released,1);
});

test('actual shipped Turi repairs split-normal joins without changing face shape, UVs, skin weights or clothing',async()=>{
  const data=await readFile(new URL('../webapp/public/assets/tirana-streets/players/turi.glb',import.meta.url));
  const loader=new GLTFLoader();loader.register(()=>({name:'HEADLESS_TEXTURES',loadTexture:async()=>new T.Texture()}));
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  let head,body;gltf.scene.traverse(mesh=>{if(mesh.material?.name==='Turi multi-view head')head=mesh;if(mesh.material?.name==='model')body=mesh;});
  const source=head.geometry,bodySource=body.geometry,seams=turiSurfaceSeams(source);
  assert.ok(seams.edges.length>1000,'actual photo atlas has many discontinuous UV island edges');
  const release=prepareTuriSurfaceContinuity(gltf.scene);
  for(const name of ['position','uv','skinIndex','skinWeight'])assert.deepEqual(head.geometry.getAttribute(name).array,source.getAttribute(name).array);
  for(const group of seams.groups)for(const i of group)assert.deepEqual(new T.Vector3().fromBufferAttribute(head.geometry.getAttribute('normal'),i),new T.Vector3().fromBufferAttribute(head.geometry.getAttribute('normal'),group[0]));
  assert.equal(body.geometry,bodySource);release();assert.equal(head.geometry,source);
});

test('pistol support palm faces the firing palm; rifle support palm cradles its fore-end',()=>{
  const right=weaponHandFrame('glockSidearmAttack','right'),pistol=weaponHandFrame('glockSidearmAttack','left'),rifle=weaponHandFrame('assaultRifleAttack','left');
  assert.deepEqual(pistol.along,right.along);
  assert.equal(pistol.normal.x,-right.normal.x);
  assert.equal(pistol.normal.y,0);
  assert.equal(rifle.normal.y,1);assert.equal(rifle.along.x,-1);
});

test('browser atlas preparation uploads a new texture source and never mutates the embedded source image',()=>{
  const originalDocument=globalThis.document,sourceImage={width:64,height:64},geometry=seamFixture();
  const texture=new T.Texture(sourceImage),source=texture.source,material=new T.MeshStandardMaterial({map:texture});material.name='Turi multi-view head';
  const root=new T.Group(),mesh=new T.Mesh(geometry,material);root.add(mesh);
  let written,drawn;
  const pixels=new Uint8ClampedArray(64*64*4).fill(100);
  const canvas={getContext:()=>({drawImage(image){drawn=image;},getImageData:()=>({data:pixels.slice()}),putImageData(data){written=data;}})};
  globalThis.document={createElement:()=>canvas};
  try{
    const release=prepareTuriSurfaceContinuity(root);
    assert.equal(drawn,sourceImage);assert.ok(written?.data instanceof Uint8ClampedArray);
    assert.notEqual(texture.source,source);assert.equal(texture.image,canvas);
    assert.equal(source.data,sourceImage);assert.equal(texture.userData.turiSeamsRepaired,true);
    release();assert.equal(mesh.geometry,geometry);
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});
