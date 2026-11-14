import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {HUMAN_ROSTER,humanFor,actorRole,nearbyHumans,screenStick} from '../webapp/src/games/tiranastreets/street-career/humanRoster.mjs';
// Synthetic domain fixtures; actual engine integration is in the separate suite.

const weapons=[{id:'starter',magazine:12},{id:'rifle',magazine:30}];

const clone=o=>JSON.parse(JSON.stringify(o));
function result(profile,extra={}) {return {mode:'solo',phase:'finished',missionId:profile.active.id,difficulty:profile.active.difficulty,players:{local:{...clone(profile.loadout),finished:true,failed:false,health:100,finishTime:20}},...extra};}

test('six existing appearances reference only four local GLB files',()=>{assert.equal(HUMAN_ROSTER.length,6);assert.equal(new Set(HUMAN_ROSTER.map(h=>h.url)).size,4);assert.ok(HUMAN_ROSTER.every(h=>h.url.startsWith('/assets/')&&h.url.endsWith('.glb')));assert.ok(HUMAN_ROSTER.every(h=>Object.isFrozen(h.roles)));});
test('all police are existing athlete humans; military stays soldier',()=>{for(let i=0;i<100;i++){assert.match(humanFor({id:String(i),kind:'police'}).url,/athlete-(male|female)\.glb$/);assert.equal(humanFor({id:String(i),kind:'soldier'}).sourceId,'mixamo-soldier');assert.equal(actorRole('military'),'soldier');}});
test('civilian selection varies without changing for the same identity',()=>{const ids=new Set();for(let i=0;i<100;i++){const n={id:`citizen-${i}`,kind:'civilian'};ids.add(humanFor(n).id);assert.equal(humanFor(n),humanFor({...n}));}assert.equal(ids.size,5);});
test('nearby selection has exact caps and does not mutate NPC order or data',()=>{const npcs=Array.from({length:90},(_,i)=>({id:`n-${i}`,x:90-i,z:0,motion:'walk'})),before=clone(npcs);assert.equal(nearbyHumans(npcs,{x:0,z:0}).length,72);assert.equal(nearbyHumans(npcs,{x:0,z:0},true).length,28);assert.deepEqual(npcs,before);});
test('drivers and invalid/distant positions are excluded',()=>{const npcs=[{id:'drive',x:0,z:0,motion:'drive'},{id:'bad',x:NaN,z:0},{id:'far',x:500,z:0}];assert.deepEqual(nearbyHumans(npcs,{x:0,z:0}),[]);assert.deepEqual(nearbyHumans([], {x:NaN,z:0}),[]);});
test('portrait stick respects visible left/right/up/down and clamps diagonals',()=>{assert.ok(screenStick(20,0).x>0);assert.ok(screenStick(-20,0).x<0);assert.ok(screenStick(0,-20).y>0);assert.ok(screenStick(0,20).y<0);assert.ok(Math.abs(Math.hypot(...Object.values(screenStick(100,-100)))-1)<1e-12);assert.deepEqual(screenStick(NaN,0),{x:0,y:0});});
