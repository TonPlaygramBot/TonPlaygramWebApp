import test from 'node:test';
import assert from 'node:assert/strict';
import {exploreSnapshot,EXPLORE_VIEW_BUDGET} from '../webapp/src/games/tirana-social/exploreSnapshot.mjs';
import {exploreSimulation} from '../webapp/src/games/tirana-social/exploreSimulation.mjs';

test('social wire projection removes cyclic AI state without mutating the authority',()=>{
  const person={id:'npc',x:1,z:1,kind:'civilian',heading:.2,speed:1,health:100,debug:'x'.repeat(1000000)};person.walkPlan={point:person};
  const state={elapsed:1,players:{me:{id:'me',x:0,z:0,input:{x:1},inventory:{gun:1}}},npcs:[person],cars:[],traffic:[],effects:[],units:[]};
  const wire=exploreSnapshot(state,'me');assert.doesNotThrow(()=>JSON.stringify(wire));assert.equal(wire.npcs[0].heading,.2);assert.equal('walkPlan' in wire.npcs[0],false);assert.equal('debug' in wire.npcs[0],false);assert.equal('input' in wire.players.me,false);assert.deepEqual(wire.players.me.inventory,{});assert.equal(state.npcs[0].walkPlan.point,person);
});

test('nearby actor budget preserves own driven vehicle and safe passenger visuals',()=>{
  const state={players:{me:{id:'me',x:0,z:0,carId:'owned'}},npcs:Array.from({length:50},(_,i)=>({id:`n${i}`,x:i,z:0})),cars:[{id:'owned',x:999,z:0,driver:'me',passengers:[{seat:1,face:2,shirt:3}]}],traffic:Array.from({length:80},(_,i)=>({id:`t${i}`,x:i,z:0})),effects:[],units:[]};
  const wire=exploreSnapshot(state,'me');assert.equal(wire.npcs.length,EXPLORE_VIEW_BUDGET.people);assert.equal(wire.cars.length+wire.traffic.length,EXPLORE_VIEW_BUDGET.vehicles);assert.equal(wire.cars[0].id,'owned');assert.deepEqual(wire.cars[0].passengers,[{seat:1,face:2,shirt:3}]);assert.equal(state.traffic.length,80);
});

test('real four-player city remains JSON serializable and bounded after simulation ticks',()=>{
  const state=exploreSimulation.createState([]);
  for(let i=0;i<4;i++)exploreSimulation.addPlayer(state,{id:`person-${i}`,name:`Person ${i}`},i);
  for(let i=0;i<3;i++)exploreSimulation.advanceState(state,.034);
  for(let i=0;i<4;i++){
    const wire=exploreSimulation.publicState(state,`person-${i}`),encoded=JSON.stringify(wire);
    assert.ok(Buffer.byteLength(encoded)<40000,`player ${i}: ${Buffer.byteLength(encoded)} bytes`);
    assert.equal(Object.keys(wire.players).length,4);assert.ok(wire.npcs.length<=12);assert.ok(wire.cars.length+wire.traffic.length<=28);
    assert.deepEqual(wire.effects,[]);assert.deepEqual(wire.units,[]);
  }
});
