import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import {load,T} from '../webapp/scripts/vehicle-wheels/loadAsset.mjs';
const file=new URL('../webapp/node_modules/.cache/vehicle-materials-test.mjs',import.meta.url);
mkdirSync(new URL('.',file),{recursive:true});
buildSync({entryPoints:[fileURLToPath(new URL('../webapp/src/games/tiranastreets/vehicleMaterials.ts',import.meta.url))],outfile:fileURLToPath(file),bundle:true,platform:'node',format:'esm',external:['three','three/*'],logLevel:'silent'});
const {prepareVehicleMaterials}=await import(file);
const rootFor=materials=>{const root=new T.Group();for(const material of materials)root.add(new T.Mesh(new T.BoxGeometry(1,1,1),material));return root;};
test('texture-alpha BLEND keeps transparent depth at opacity one; MASK and opaque retain depth',()=>{
 const map=new T.Texture(),blend=new T.MeshStandardMaterial({transparent:true,opacity:1,map}),masked=new T.MeshStandardMaterial({transparent:true,opacity:1,map,alphaTest:.5}),opaque=new T.MeshStandardMaterial({map});
 const alphaOnly=new T.MeshStandardMaterial({transparent:true,opacity:1,alphaMap:new T.Texture()});
 const root=rootFor([blend,masked,opaque,alphaOnly]);prepareVehicleMaterials(root);
 assert.equal(blend.depthWrite,false);assert.equal(alphaOnly.depthWrite,false);assert.equal(masked.depthWrite,true);assert.equal(opaque.depthWrite,true);
 assert.equal(root.userData.vehicleMaterialAudit.transparent,2);
});
test('normal and packed data maps retain linear interpretation even when a color material shares them',()=>{
 const shared=new T.Texture(),roughness=new T.Texture(),normal=new T.Texture();
 const body=new T.MeshStandardMaterial({map:shared,emissiveMap:roughness}),trim=new T.MeshStandardMaterial({normalMap:shared,roughnessMap:roughness,metalnessMap:roughness}),separate=new T.MeshStandardMaterial({normalMap:normal});
 const root=rootFor([body,trim,separate]);prepareVehicleMaterials(root);
 assert.equal(shared.colorSpace,T.NoColorSpace);assert.equal(roughness.colorSpace,T.NoColorSpace);assert.equal(normal.colorSpace,T.NoColorSpace);
 assert.equal(trim.normalMap,shared);assert.equal(trim.roughnessMap,roughness);assert.equal(separate.normalMap,normal);
 assert.notEqual(body.map,shared);assert.equal(body.map.source,shared.source);assert.equal(body.map.colorSpace,T.SRGBColorSpace);
 assert.notEqual(body.emissiveMap,roughness);assert.equal(body.emissiveMap.colorSpace,T.SRGBColorSpace);
 const color=body.map,emissive=body.emissiveMap;prepareVehicleMaterials(root);assert.equal(body.map,color);assert.equal(body.emissiveMap,emissive,'repeat preparation must not duplicate GPU views');
});
for(const [id,name] of [['fiat','gt_windows'],['benz','Meshesmiutus65glass0011Mtl']])test(`${id}: actual embedded texture-alpha window is recognized without changing data map color spaces`,async()=>{
 const source=await load(new URL(`../webapp/public/assets/tirana-streets/vehicle-collection/${id}.glb`,import.meta.url));
 let pane;const originalData=[];
 source.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){if(m.name===name)pane=m;for(const t of [m.normalMap,m.roughnessMap,m.metalnessMap])if(t)originalData.push([t,t.colorSpace]);}});
 assert.ok(pane?.transparent&&pane.map);assert.equal(pane.opacity,1);pane.depthWrite=true;
 prepareVehicleMaterials(source);assert.equal(pane.depthWrite,false);
 for(const [texture,colorSpace] of originalData)assert.equal(texture.colorSpace,colorSpace);
});
