import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from '../webapp/node_modules/esbuild/lib/main.js';
import {cablePath} from '../webapp/src/games/tirana-expansion/geography.mjs';
import {CHAPTERS} from '../webapp/src/games/tiranastreets/career/careerCore.mjs';
const temporary=await mkdtemp(join(tmpdir(),'tirana-panorama-'));
let CareerRuntime,RegionalPanorama;
try{
 const outfile=join(temporary,'runtime.mjs');
 await build({stdin:{contents:"export {CareerRuntime} from './webapp/src/games/tiranastreets/career/CareerRuntime.ts';export {RegionalPanorama} from './webapp/src/games/tirana-region/RegionalPanorama.ts';",resolveDir:new URL('../',import.meta.url).pathname,loader:'ts'},outfile,bundle:true,platform:'node',format:'esm'});
 ({CareerRuntime,RegionalPanorama}=await import(pathToFileURL(outfile).href));
}finally{await rm(temporary,{recursive:true,force:true});}
test('actual career tick completes once, holds at Dajti and returns without losing completion',()=>{
 const game=Object.create(CareerRuntime.prototype);let saves=0,pauses=0,tour=true;
 Object.assign(game,{paused:false,ride:true,overlook:false,rideElapsed:89.99,profile:{version:1,completed:CHAPTERS.slice(0,-1).map(c=>c.id),bestTimes:{},active:{id:'dajti-connection',step:1,elapsed:10,status:'active'}},extras:{dajti:{path:cablePath([41.3275,19.8188]),setTour:v=>{tour=v;}}},persist:()=>saves++,emit:()=>{},pause:()=>pauses++});
 game.tick(1/60);assert.equal(game.ride,false);assert.equal(game.overlook,true);assert.equal(game.rideElapsed,90);assert.equal(game.profile.completed.length,6);assert.equal(game.profile.active,null);assert.ok(game.pitch<0);assert.ok(Number.isFinite(game.rideYaw));
 const saved=JSON.stringify(game.profile);for(let i=0;i<200;i++)game.tick(1/60);assert.equal(JSON.stringify(game.profile),saved);assert.equal(saves,1);
 game.returnFromOverlook();assert.equal(game.overlook,false);assert.equal(game.ride,false);assert.equal(tour,false);assert.equal(pauses,1);assert.equal(JSON.stringify(game.profile),saved);
});
test('actual panorama builds only at altitude, restores clipping and releases geometry',()=>{
 const layer=new RegionalPanorama(),camera={far:18000,updateProjectionMatrix(){}};
 layer.update({x:0,y:1.68,z:0},camera);assert.equal(layer.group.children.length,0);
 layer.update({x:7200,y:1050,z:-4500},camera);assert.equal(layer.group.visible,true);assert.equal(camera.far,65000);assert.equal(layer.group.children.length,4);
 const meshes=[...layer.group.children];let disposed=0;
 for(const mesh of meshes){mesh.geometry.addEventListener('dispose',()=>disposed++);const p=mesh.geometry.attributes.position;for(let i=0;i<p.array.length;i++)assert.ok(Number.isFinite(p.array[i]));}
 layer.update({x:0,y:1.68,z:0},camera);assert.equal(layer.group.visible,false);assert.equal(camera.far,18000);
 layer.dispose();assert.equal(disposed,meshes.length);assert.equal(layer.group.children.length,0);
});
