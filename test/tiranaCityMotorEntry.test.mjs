import test from 'node:test';
import assert from 'node:assert/strict';
import {movePlayer} from '../webapp/src/games/tiranastreets-november/shared/engine.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';

test('live city player motor inherits the paced acceleration and stops without leaving a mapped road',()=>{
 const road=WORLD.roads.find(r=>!r.walk&&r.w===6.2&&r.name==='Rruga Sami Frashëri'&&Math.hypot(r.b[0]-r.a[0],r.b[1]-r.a[1])>48);
 assert.ok(road);
 const l=Math.hypot(road.b[0]-road.a[0],road.b[1]-road.a[1]),fx=(road.b[0]-road.a[0])/l,fz=(road.b[1]-road.a[1])/l;
 const a={x:road.a[0]+fx*5,z:road.a[1]+fz*5};
 const car={id:'fixture-city-car',...a,heading:Math.atan2(-fx,-fz),speed:0,collectionVehicle:'ford',driver:'local'};
 const person={id:'local',carId:car.id,health:100,input:{x:0,y:1,brake:false},inputAt:0,...a};
 const state={elapsed:0,cars:[car],traffic:[],units:[],players:{local:person}};let contacts=0;
 const step=1/60;
 for(let i=0;i<120;i++){state.elapsed+=step;person.inputAt=state.elapsed;movePlayer(state,person,step,()=>contacts++);}
 assert.ok(person.speed>10&&person.speed<13,'two-second urban pace in m/s');
 person.input={x:0,y:0,brake:true};let stopFrame=0;
 while(person.speed>0&&stopFrame++<120){state.elapsed+=step;person.inputAt=state.elapsed;movePlayer(state,person,step,()=>contacts++);}
 assert.ok(stopFrame<120);
 assert.equal(person.speed,0);assert.equal(contacts,0);
 const dx=car.x-a.x,dz=car.z-a.z;
 assert.ok(Math.abs(-fz*dx+fx*dz)<1e-5);assert.ok(dx*fx+dz*fz<l-5);
});
