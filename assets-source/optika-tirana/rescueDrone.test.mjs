import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rescueTargetFrom,createRescueFlight} from './rescueDrone.mjs';
import {makeWalkability,approachLandmark} from './publicMapGeometry.mjs';
const map=JSON.parse(await readFile(new URL('../../webapp/public/assets/optika-tirana-v1/assets/public-tirana-center.json',import.meta.url)));
const walkable=makeWalkability(map);
const square=approachLandmark(map.landmarks.find(l=>l.id==='square'),walkable);
const van=rescueTargetFrom(square,walkable);
test('vehicle starts outside scan radius, outside walls and not at a named checkpoint',()=>{
  assert.ok(walkable(van.x,van.z,2.5));
  assert.ok(Math.hypot(van.x-square.x,van.z-square.z)>=18);
  assert.equal(createRescueFlight(van,square).interact().phase,'search');
});
test('search and dispatch are distinct intentional interactions, with no repeat dispatch',()=>{
  const flight=createRescueFlight(van,square);
  assert.equal(flight.fly(van.x,24,van.z,map.bounds).phase,'search');
  assert.equal(flight.interact().phase,'found');
  assert.equal(flight.interact().phase,'dispatched');
  assert.equal(flight.interact().phase,'dispatched');
});
test('flight is a bounded visual simulation and cannot notify from distant or high viewpoints',()=>{
  const flight=createRescueFlight(van,square);
  assert.equal(flight.fly(van.x,700,van.z,map.bounds).y,42);
  assert.equal(flight.interact().phase,'search');
  assert.equal(flight.fly(Infinity,NaN,0,map.bounds).y,42);
  const b=map.bounds;
  assert.deepEqual(flight.fly(-99999,-99999,99999,b),{x:b[0]+2,y:6,z:b[3]-2,phase:'search',canInteract:false});
});
test('imported visual is a GLB with four distinct named rotor nodes',async()=>{
  const buffer=await readFile(new URL('../../webapp/public/assets/optika-tirana-v1/assets/civil-survey-drone.glb',import.meta.url));
  assert.equal(buffer.readUInt32LE(0),0x46546c67);
  assert.equal(buffer.readUInt32LE(4),2);
  assert.equal(buffer.readUInt32LE(8),buffer.length);
  const j=JSON.parse(buffer.toString('utf8',20,20+buffer.readUInt32LE(12)));
  const rotors=j.nodes.filter(n=>/^Rotor_(FL|FR|RL|RR)$/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
  assert.deepEqual(rotors.map(n=>[n.name,n.extras.spinDirection]),[['Rotor_FL',-1],['Rotor_FR',1],['Rotor_RL',1],['Rotor_RR',-1]]);
});
