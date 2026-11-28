import {test} from 'node:test';
import assert from 'node:assert/strict';
import {raceItemPickups,stepRaceItems,RACE_ITEM_RULES} from '../webapp/src/games/kartroyale/raceItems.mjs';
import {sampleCircuitDistance} from '../webapp/src/games/kartroyale/circuitMetrics.mjs';
import {resampleCircuit} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
const shape=resampleCircuit([[0,0],[0,800],[300,800],[300,0]],240);
const wide={...shape,width:16},narrow={...shape,width:6.5};
const shift=(track,p)=>{const q=sampleCircuitDistance(track,p.distance);return Math.hypot(q.x-p.x,q.z-p.z);};
test('broad boulevards gain distinct boost and shield lines without moving rocket pickups or changing IDs',()=>{
 const a=raceItemPickups(wide),b=raceItemPickups(narrow);
 assert.deepEqual(a.map(p=>[p.id,p.kind,p.distance]),b.map(p=>[p.id,p.kind,p.distance]));
 assert.ok(a.some(p=>p.kind==='boost'&&shift(wide,p)>RACE_ITEM_RULES.pickupRadius));
 assert.ok(a.some(p=>p.kind==='shield'&&shift(wide,p)>RACE_ITEM_RULES.pickupRadius));
 assert.ok(a.filter(p=>p.kind==='rocket').every(p=>shift(wide,p)===0));
 assert.ok(b.every(p=>shift(narrow,p)===0));
});
test('straight lane choice is real and does not change personal pickup availability',()=>{
 const pads=raceItemPickups(wide);
 const p=pads.find(p=>p.kind==='boost'&&shift(wide,p)>2.4);
 const center=sampleCircuitDistance(wide,p.distance);
 const racer=(id,x,z)=>({id,x,z,speed:10,input:{}});
 const a=racer('a',p.x,p.z),b=racer('b',p.x,p.z),c=racer('c',center.x,center.z);
 stepRaceItems([a,b,c],wide,1/60,3);
 assert.equal(a.raceItem,'boost');
 assert.equal(b.raceItem,'boost');
 assert.equal(c.raceItem,null);
 assert.equal(a.itemCooldowns[p.id],3+RACE_ITEM_RULES.pickupCooldown);
});
test('a short sharp corner keeps the pickup centred even if the road is wide',()=>{
 const track={points:[{x:0,z:0},{x:0,z:35},{x:25,z:35},{x:25,z:0}],width:16,length:120};
 const p=raceItemPickups(track);
 assert.ok(p.some(x=>x.kind==='boost'));
 assert.ok(p.every(x=>shift(track,x)<1e-8));
});
