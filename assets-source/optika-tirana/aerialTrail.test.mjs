import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAerialTrail} from './aerialTrail.mjs';
const pub=[{id:'square',x:0,z:0},{id:'clock',x:33,z:75},{id:'pyramid',x:110,z:490}];
test('aerial checkpoints require sequential 3D crossings with valid altitude',()=>{
  const flight=createAerialTrail(pub);
  assert.equal(flight.advance({x:33,z:75,y:24},.02).index,0);
  assert.equal(flight.advance({x:12,z:0,y:6},.02).index,0);
  assert.equal(flight.advance(flight.state().target,.02).index,1);
  assert.equal(flight.advance(flight.state().target,.02).index,2);
  assert.equal(flight.advance(flight.state().target,.02).complete,true);
  assert.equal(flight.state().target,null);
});
test('air plays independently; one completed or abandoned run is not a rescue case',()=>{
  const a=createAerialTrail(pub),b=createAerialTrail(pub);
  assert.equal(a.advance(a.state().target,.05).index,1);
  assert.equal(b.state().index,0);
  assert.equal(b.state().seconds,0);
  assert.equal(a.advance(a.state().target,-3).index,1);
  assert.equal(a.advance({x:NaN,z:0,y:22},.05).seconds,.1);
});
