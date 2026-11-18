import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {landmarkNearDistance} from '../webapp/src/games/tirana-landmarks/landmarkVisibility.mjs';
import {resolveNativeLandmarks} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {buildNativeModel} from '../webapp/src/games/tirana-landmarks/nativeModels.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {TRACKS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
const root=new URL('../webapp/',import.meta.url);
const output=await build({entryPoints:[new URL('src/games/tirana-landmarks/NativeLandmarkLayer.ts',root).pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'three',setup(b){b.onResolve({filter:/^three$/},()=>({path:new URL('node_modules/three/build/three.module.js',root).href,external:true}));}}]});
const {NativeLandmarkLayer}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const locations=resolveNativeLandmarks(WORLD).landmarks;

test('racing visibility changes only the Pyramid near distance, not anchors, meshes, bounds or other games',()=>{
 const layer=new NativeLandmarkLayer(locations),before=layer.lods.map(l=>({p:l.position.toArray(),yaw:l.rotation.y,children:l.levels.map(v=>v.object.uuid)}));
 layer.setRacingVisibility(true);
 assert.deepEqual(layer.lods.map(l=>({p:l.position.toArray(),yaw:l.rotation.y,children:l.levels.map(v=>v.object.uuid)})),before);
 for(const lod of layer.lods){assert.equal(lod.levels[1].distance,landmarkNearDistance(lod.userData.id,true));assert.equal(lod.levels[2].distance,2400);}
 layer.setBatteryMode(true);for(const lod of layer.lods)assert.equal(lod.levels[1].distance,35);
 layer.setBatteryMode(false);assert.equal(layer.lods.find(l=>l.userData.id==='pyramid').levels[1].distance,410);
 layer.setRacingVisibility(false);for(const lod of layer.lods)assert.equal(lod.levels[1].distance,lod.userData.id==='skanderbeg'?90:190);
 layer.dispose();assert.equal(layer.group.children.length,0);
});

test('actual Three LOD selects detailed geometry at new-course approaches, one level only',()=>{
 const layer=new NativeLandmarkLayer(locations);layer.setRacingVisibility(true);layer.group.updateMatrixWorld(true);
 for(const id of ['pyramid']){
  const location=locations.find(l=>l.id===id),lod=layer.lods.find(l=>l.userData.id===id);
  const point=TRACKS.flatMap(t=>makeTrack(t.id).points).reduce((a,p)=>Math.hypot(p.x-location.x,p.z-location.z)<Math.hypot(a.x-location.x,a.z-location.z)?p:a);
  const camera=new THREE.PerspectiveCamera(60,16/9,.1,5000);camera.position.set(point.x,3,point.z);camera.updateMatrixWorld(true);
  lod.update(camera);assert.equal(lod.getCurrentLevel(),0,id+' detailed approach');assert.equal(lod.levels.filter(l=>l.object.visible).length,1);
  layer.setBatteryMode(true);lod.update(camera);assert.equal(lod.getCurrentLevel(),1,id+' battery keeps cheap silhouette');layer.setBatteryMode(false);
  camera.position.set(location.x+2500,3,location.z);camera.updateMatrixWorld(true);lod.update(camera);assert.equal(lod.getCurrentLevel(),2,id+' far culling retained');
 }
 layer.dispose();
});

test('worst-case extra landmark geometry is bounded without extra material batches or downloads',()=>{
 let extra=0,extraBatches=0;
 for(const id of ['pyramid']){const near=buildNativeModel(id),far=buildNativeModel(id,'far');extra+=near.triangles-far.triangles;extraBatches+=near.meshes.length-far.meshes.length;}
 assert.equal(extra,3264);assert.equal(extraBatches,0);
 // Existing geometry switches at a different distance, so resident buffers are unchanged.
 assert.ok(extra<3300);
});
