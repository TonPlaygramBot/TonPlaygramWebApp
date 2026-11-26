import assert from 'node:assert/strict';
import test from 'node:test';
import {PausedRenderBudget,PAUSED_SETTLE_MS,PAUSED_SETTLE_FPS,PAUSED_IDLE_FPS} from '../webapp/src/games/tiranastreets-november/street-career/pausedRenderBudget.mjs';

test('paused views settle at the normal menu rate, then fall to a heartbeat', () => {
  const p = new PausedRenderBudget();
  assert.equal(p.rate(0, 390, 844), PAUSED_SETTLE_FPS);
  assert.equal(p.rate(PAUSED_SETTLE_MS-1, 390, 844), PAUSED_SETTLE_FPS);
  assert.equal(p.rate(PAUSED_SETTLE_MS, 390, 844), PAUSED_IDLE_FPS);
  assert.ok(PAUSED_IDLE_FPS>0 && PAUSED_IDLE_FPS<PAUSED_SETTLE_FPS);
});

test('settings, returning to the view and canvas resizing restore fast repaint', () => {
  const p = new PausedRenderBudget();
  p.rate(0, 390, 844);
  assert.equal(p.rate(3000, 390, 844), PAUSED_IDLE_FPS);
  p.invalidate(3010);
  assert.equal(p.rate(3011, 390, 844), PAUSED_SETTLE_FPS);
  assert.equal(p.rate(6000, 390, 844), PAUSED_IDLE_FPS);
  assert.equal(p.rate(6001, 844, 390), PAUSED_SETTLE_FPS);
  assert.equal(p.rate(8000, 844, 390), PAUSED_IDLE_FPS);
});
