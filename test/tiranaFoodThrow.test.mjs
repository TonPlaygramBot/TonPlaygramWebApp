import test from 'node:test';
import assert from 'node:assert/strict';
import {ThrowableSimulation} from '../webapp/src/games/tiranastreets-november/street-career/ThrowableSimulation.mjs';
import {WEAPON_BY_ID} from '../webapp/src/games/tiranastreets-november/shared/weapons.mjs';
function fixture(id='egg'){
 const report=[];
 const player={weapon:id,health:100,nextShot:0,inventory:{egg:{ammo:4},tomato:{ammo:4}}};
 const s={paused:false,player,body:{yaw:0,pitch:0,interaction:'free',action:null},state:{elapsed:0,npcs:[]},eye:()=>({x:0,y:1.5,z:0}),cars:()=>[],world:{cast(a,d,n){return {kind:'air',distance:n,point:{x:a.x+d.x*n,y:a.y+d.y*n,z:a.z+d.z*n}};}},event:(kind,v)=>report.push([kind,v]),arrest:{locked:false}};
 const t=new ThrowableSimulation(s);
 return {s,t,player,report,time(n){s.state.elapsed=n;t.step(0);}};
}
test('one release spends one item at contact, no item from hold alone',()=>{
 const f=fixture();
 assert.equal(f.t.begin(),true);f.time(.85);
 assert.equal(f.player.inventory.egg.ammo,4);assert.equal(f.s.body.foodPose.load,1);
 assert.equal(f.t.release(),true);assert.equal(f.t.release(),false);
 f.time(.98);assert.equal(f.player.inventory.egg.ammo,4);
 f.time(1.01);assert.equal(f.player.inventory.egg.ammo,3);
 assert.equal(f.t.items.length,1);assert.equal(f.s.body.foodPose.released,true);
 f.time(1.5);assert.equal(f.t.items.length,1);assert.equal(f.report.length,1);
});
test('a long press throws farther than a tap for each in-game food prop',()=>{
 for(const id of ['egg','tomato']){
  const short=fixture(id),held=fixture(id);
  short.t.begin();short.t.release();short.time(.16);
  held.t.begin();held.time(1);held.t.release();held.time(1.16);
  assert.ok(Math.abs(held.t.items[0].vz)>Math.abs(short.t.items[0].vz));
  assert.ok(held.t.items[0].vy>short.t.items[0].vy);
 }
});
test('cancel, pause, item switch and unsent repeats spend no extra ammo',()=>{
 const f=fixture();
 f.t.begin();f.t.cancel();assert.equal(f.t.release(),false);f.time(1);
 assert.equal(f.player.inventory.egg.ammo,4);assert.equal(f.t.items.length,0);
 f.t.begin();f.t.release();f.s.paused=true;f.time(1.16);
 assert.equal(f.player.inventory.egg.ammo,4);assert.equal(f.t.items.length,0);
 f.s.paused=false;f.t.begin();f.player.weapon='tomato';f.time(2);
 assert.equal(f.t.release(),false);assert.equal(f.player.inventory.egg.ammo,4);
 assert.equal(f.t.throw(WEAPON_BY_ID.get('tomato')),true);
 assert.equal(f.t.throw(WEAPON_BY_ID.get('tomato')),false);
 f.time(2.16);assert.equal(f.player.inventory.tomato.ammo,3);
});
