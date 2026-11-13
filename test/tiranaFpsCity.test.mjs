import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {nativeLandmarkObstacles} from '../webapp/src/games/tirana-landmarks/nativeCollision.mjs';
import {resolveNativeLandmarks} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {collides, rayBox, lineClear} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {ORIGIN, START, OBSTACLES, EXTRACTION} from '../webapp/src/games/blackwater/shared/layout.mjs';
import games from '../webapp/src/config/gamesCatalog.js';

test('concave mapped buildings block their walls but leave their courtyards open',()=>{
  const l={x:4,z:4,w:8,d:8,h:10,footprint:[[0,0],[8,0],[8,2],[2,2],[2,8],[0,8]]};
  assert.equal(collides(6,6,.4,[l]),false);
  assert.equal(collides(1,6,.4,[l]),true);
  assert.equal(rayBox({x:6,y:1,z:6},{x:-1,y:0,z:0},l),4);
  assert.equal(rayBox({x:6,y:20,z:6},{x:0,y:-1,z:0},l),Infinity);
  assert.equal(rayBox({x:1,y:20,z:6},{x:0,y:-1,z:0},l),10);
  assert.equal(lineClear({x:6,y:1,z:3},{x:6,y:1,z:7},[l]),true);
  assert.equal(lineClear({x:6,y:1,z:6},{x:-1,y:1,z:6},[l]),false);
});

test('all six native landmarks provide FPS cover; museum courtyard stays open',()=>{
  const obstacles=nativeLandmarkObstacles(WORLD,ORIGIN);
  assert.equal(new Set(obstacles.map(o=>o.landmarkId)).size,6);
  const museum=resolveNativeLandmarks(WORLD).landmarks.find(l=>l.id==='museum');
  const x=museum.x-ORIGIN.x,z=museum.z-ORIGIN.z;
  assert.equal(collides(x,z,.4,obstacles),false);
  assert.equal(collides(x+37,z,.4,obstacles),true);
  assert.equal(lineClear({x,y:1.7,z},{x:x+60,y:1.7,z},obstacles),false);
  assert.equal(collides(START.x,START.z,.45,OBSTACLES),false);
  assert.equal(collides(EXTRACTION.x,EXTRACTION.z,.45,OBSTACLES),false);
});

test('the catalog exposes one Tirana FPS game',()=>{
  assert.equal(games.filter(g=>g.slug==='tiranastreets').length,1);
  assert.equal(games.some(g=>g.slug==='blackwater'),false);
  assert.equal(games.find(g=>g.slug==='tiranastreets').route,'/games/tiranastreets/lobby');
});

test('the retained street GLB has local texture and decoder dependencies',()=>{
  const base=new URL('../webapp/public/assets/tirana-streets/',import.meta.url);
  for(const name of ['street-kit.glb','street-furniture.glb']) {
    const bytes=readFileSync(new URL(name,base));
    assert.equal(bytes.toString('ascii',0,4),'glTF');
    assert.equal(bytes.readUInt32LE(4),2);
    assert.equal(bytes.readUInt32LE(8),bytes.length);
    const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    for(const image of data.images||[]) if(image.uri) {
      assert.ok(!/^(https?:|\/)/.test(image.uri));
      assert.ok(existsSync(new URL(image.uri,base)),image.uri);
    }
    if(data.extensionsRequired?.includes('KHR_draco_mesh_compression'))
      for(const file of ['draco/draco_wasm_wrapper.js','draco/draco_decoder.wasm']) assert.ok(existsSync(new URL(file,base)));
  }
});
