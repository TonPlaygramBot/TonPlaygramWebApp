import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacleHitNormal,traceBattleSurface} from '../webapp/src/games/blackwater/shared/shotFeedback.mjs';
import {rayBox} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {battleGround} from '../webapp/src/games/blackwater/shared/terrain.mjs';
const box={x:0,z:0,w:4,d:4,h:8};
const y=battleGround(0,0)+2;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('battlefield impact lands on the first wall and faces the incoming shot',()=>{
  const hit=traceBattleSurface({x:0,y,z:10},{x:0,y:0,z:-1},30,[box,{...box,z:-12}]);
  close(hit.distance,8);assert.equal(hit.kind,'wall');assert.deepEqual(hit.normal,{x:0,y:0,z:1});
});
test('oriented wall chips use the collision box rotation',()=>{
  const rotated={...box,rot:Math.PI/4};
  const hit=traceBattleSurface({x:8,y,z:0},{x:-1,y:0,z:0},20,[rotated]);
  assert.equal(hit.kind,'wall');assert.ok(hit.normal.x>.7);close(Math.hypot(hit.normal.x,hit.normal.y,hit.normal.z),1);
  close(hit.distance,rayBox({x:8,y,z:0},{x:-1,y:0,z:0},rotated));
});
test('courtyard and roof hits have surface normals; interior contacts have none',()=>{
  const shape={...box,w:12,d:12,footprint:[[-6,-6],[6,-6],[6,6],[-6,6]],holes:[[[-2,-2],[-2,2],[2,2],[2,-2]]]};
  const inside=obstacleHitNormal({x:2,y,z:0},{x:1,y:0,z:0},shape);
  close(inside.x,-1);close(inside.y,0);close(inside.z,0);
  const roof=traceBattleSurface({x:4,y:battleGround(0,0)+15,z:0},{x:0,y:-1,z:0},20,[shape]);
  assert.equal(roof.kind,'wall');assert.equal(roof.normal.y,1);close(roof.distance,7);
  assert.equal(obstacleHitNormal({x:4,y,z:0},{x:1,y:0,z:0},shape),null);
});
test('misses create no floating mark; terrain blocks downward shots',()=>{
  const start={x:0,y:battleGround(0,0)+3,z:0};
  assert.equal(traceBattleSurface(start,{x:0,y:1,z:0},30,[]).kind,'air');
  const ground=traceBattleSurface(start,{x:0,y:-1,z:0},30,[]);
  assert.equal(ground.kind,'ground');assert.ok(ground.normal.y>.9);assert.ok(Math.abs(ground.distance-2.92)<.002);
});
test('indexed surface traces preserve nearest-wall results in a large sparse district',()=>{
  const obstacles=Array.from({length:2000},(_,i)=>({...box,x:1000+(i%50)*10,z:1000+Math.floor(i/50)*10}));
  obstacles.push({...box,x:18,z:12});
  const start={x:0,y:battleGround(18,12)+3,z:12},dir={x:1,y:0,z:0};
  const expected=Math.min(80,...obstacles.map(o=>rayBox(start,dir,o)));
  const hit=traceBattleSurface(start,dir,80,obstacles);
  close(hit.distance,expected);assert.equal(hit.kind,'wall');
});
