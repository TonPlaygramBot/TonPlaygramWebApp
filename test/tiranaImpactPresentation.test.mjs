import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {StreetWorld} from '../webapp/src/games/tiranastreets/street-career/spatialCore.mjs';

const require=createRequire(new URL('../webapp/package.json',import.meta.url)),T=require('three'),ts=require('typescript');
const module={exports:{}};

const hit=(id,more={})=>({id,at:0,kind:'hit',hitKind:'wall',x:0,y:1,z:0,nx:0,ny:0,nz:1,...more});

test('world rays report the actual wall/roof plane normal, including rotated walls',()=>{
  const world=new StreetWorld([{id:'wall',p:[[0,0],[10,0],[10,10],[0,10]],h:20}],false);
  const face=world.cast({x:-3,y:4,z:5},{x:1,y:0,z:0},10);
  assert.equal(face.kind,'wall');assert.ok(new T.Vector3(face.normal.x,face.normal.y,face.normal.z).distanceTo(new T.Vector3(-1,0,0))<1e-10);
  const top=world.cast({x:5,y:30,z:5},{x:0,y:-1,z:0},20);
  assert.equal(top.kind,'wall');assert.deepEqual(top.normal,{x:0,y:1,z:0});
  const diagonal=new StreetWorld([{id:'rotated',p:[[0,0],[10,10],[0,20],[-10,10]],h:20}],false);
  const edge=diagonal.cast({x:12,y:5,z:3},{x:-1,y:0,z:0},20);
  assert.equal(edge.kind,'wall');assert.ok(Math.abs(edge.normal.x-Math.SQRT1_2)<1e-10);assert.ok(Math.abs(edge.normal.z+Math.SQRT1_2)<1e-10);
});
