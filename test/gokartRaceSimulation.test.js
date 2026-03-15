import test from 'node:test';
import assert from 'node:assert/strict';
import { createRaceSimulation } from '../webapp/src/pages/Games/gokart/systems/createRaceSimulation.js';
import { TRACKS_BY_ID } from '../webapp/src/pages/Games/gokart/trackConfig.js';

test('gokart simulation advances lap when crossing finish line', () => {
  const sim = createRaceSimulation({ canvasWidth: 120, canvasHeight: 100, laps: 2 });

  let result;
  for (let i = 0; i < 30; i++) {
    result = sim.update({ up: false, down: false });
    if (result.lapChanged) break;
  }

  assert.equal(Boolean(result?.lapChanged), true);
  assert.equal(sim.getState().currentLap, 2);
});

test('gokart track map exposes expected defaults', () => {
  assert.equal(TRACKS_BY_ID.lighthouse.label, 'Lighthouse Loop');
  assert.equal(TRACKS_BY_ID.snow.laps, 5);
});
