import assert from 'node:assert/strict';
import test from 'node:test';
import {GameplayFrameStats} from '../webapp/src/games/tiranastreets-november/street-career/gameplayFrameStats.mjs';

test('counts 250 ms, 600 ms and 1.2 s intervals during active rendering', () => {
  const timing = new GameplayFrameStats();
  assert.equal(timing.record(0,true),null);
  assert.deepEqual(timing.record(250,true),{fps:4,p95:250,longestMs:250,samples:1});
  assert.deepEqual(timing.record(850,true),{fps:2.4,p95:600,longestMs:600,samples:2});
  assert.deepEqual(timing.record(2050,true),{fps:1.5,p95:1200,longestMs:1200,samples:3});
});
test('retains an active 2.5 s stall in full instead of a normalized high FPS', () => {
  const timing = new GameplayFrameStats();
  timing.record(0,true);
  assert.deepEqual(timing.record(2500,true),{fps:.4,p95:2500,longestMs:2500,samples:1});
});
test('does not mix pause, background or pre-resume gaps into gameplay', () => {
  const timing = new GameplayFrameStats();
  timing.record(0,true);timing.record(20,true);timing.record(40,true);
  assert.equal(timing.record(1000,false),null);
  assert.equal(timing.record(5000,true),null);
  assert.deepEqual(timing.record(5017,true),{fps:59,p95:17,longestMs:17,samples:1});
  // Runtime also handles pause/resume with no paused render in between.
  timing.suspend();
  assert.equal(timing.record(12000,true),null);
  assert.deepEqual(timing.record(12020,true),{fps:50,p95:20,longestMs:20,samples:1});
});
test('rolling window removes old intervals and bounds sample work at high refresh', () => {
  const timing = new GameplayFrameStats();
  for (let i=0;i<2000;i++)timing.record(i,true);
  const rapid = timing.record(2001,true);
  assert.ok(rapid.samples<=240);
  assert.ok(rapid.p95<=2);
  const stalled = timing.record(5000,true);
  assert.deepEqual(stalled,{fps:.3,p95:2999,longestMs:2999,samples:1});
});
