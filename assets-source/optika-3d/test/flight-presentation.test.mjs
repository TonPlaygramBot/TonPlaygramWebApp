import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FLIGHT_CUT_SECONDS as duration,flightPresentation as visual} from '../src/flightPresentation.ts';

test('starts and returns to the player camera smoothly', () => {
  assert.equal(visual(0).blend, 0);
  assert.equal(visual(duration/2).blend,1);
  assert.equal(visual(duration).blend,0);
  assert.equal(visual(-1).blend,0);
  assert.equal(visual(duration+1).blend,0);
});

test('tracer moves forward and the visual cut ends before impact', () => {
  let previous=0;
  for(let i=0;i<=120;i++){
    const next=visual(i/120*duration);
    assert.ok(next.travel>=previous && next.travel<1);
    assert.ok(next.blend>=0 && next.blend<=1);
    previous=next.travel;
  }
});
