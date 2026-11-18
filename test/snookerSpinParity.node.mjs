import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as pool from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import * as snooker from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

const source = name => readFileSync(new URL(`../webapp/src/pages/Games/${name}.jsx`, import.meta.url), 'utf8');
const controller = name => {
  const s = source(name); const start = s.indexOf('  // Spin controller interactions');
  return s.slice(start, s.indexOf('  const americanBallSwatches', start));
};
test('Snooker shares Pool spin functions rather than a drifting fork', () => {
  for (const [name, value] of Object.entries(pool)) assert.equal(snooker[name], value, name);
  for (const x of [-1, -.75, -.33, -.001, 0, .001, .33, .75, 1]) {
    for (const y of [-.75, -.01, 0, .01, .75]) {
      assert.deepEqual(snooker.mapSpinForPhysics({x,y}), pool.mapSpinForPhysics({x,y}));
    }
  }
});
function rig(name) {
  const handlers = new Map(), frames = new Map(); let next = 1; let cleanup;
  const box = { style: {}, getBoundingClientRect: () => ({left: 20, top: 30, width: 100, height: 100}),
    setPointerCapture() {}, releasePointerCapture() {},
    addEventListener: (key, fn) => handlers.set(key, fn), removeEventListener: key => handlers.delete(key) };
  const ref = current => ({current});
  const ctx = { ...pool, showSpinController: true, showPlayerControls: true,
    spinDotElRef: ref(null), resetSpinRef: ref(null), spinRequestRef: ref({x:0,y:0}),
    spinLegalityRef: ref({}), spinRef: ref({}), shootingRef: ref(false), cueStrokeStateRef: ref(null),
    document: {getElementById: id => id === 'spinBox' ? box : {style:{}}},
    updateSpinDotPosition() {}, useEffect: fn => cleanup = fn(),
    requestAnimationFrame: fn => { const id = next++; frames.set(id,fn); return id; },
    cancelAnimationFrame: id => frames.delete(id) };
  vm.runInNewContext(controller(name), ctx);
  return {ctx, handlers, frames, cleanup: () => cleanup(),
    send: (type, x, y, extra={}) => handlers.get(type)?.({pointerId:1, clientX:x, clientY:y,
      pointerType:'touch', preventDefault(){}, stopPropagation(){}, ...extra}),
    settle: () => { for(let time=16; frames.size && time<10000; time+=16) {
      const callbacks=[...frames.values()]; frames.clear(); callbacks.forEach(fn=>fn(time));
    } }
  };
}
const plain = value => JSON.parse(JSON.stringify(value));
test('drag, release, cancellation, repeated gestures, busy guard and cleanup match Pool', () => {
  const p=rig('PoolRoyale'), s=rig('SnookerRoyal');
  for (const r of [p,s]) {
    r.send('pointerdown', 81, 59); r.send('pointermove', 96, 105);
    r.send('pointermove', 20, 30, {pointerId:2});
    r.send('pointerup', 96,105); r.settle();
  }
  assert.deepEqual(plain(s.ctx.spinRef.current),plain(p.ctx.spinRef.current));
  assert.deepEqual(plain(s.ctx.spinRequestRef.current), {x:.52,y:-.5});
  for(const r of [p,s]) { r.send('pointerdown',65,75); r.send('pointercancel',65,75); r.settle(); }
  assert.deepEqual(plain(s.ctx.spinRef.current),plain(p.ctx.spinRef.current));
  assert.deepEqual(plain(s.ctx.spinRequestRef.current), {x:-.09999999999999998,y:.09999999999999998});
  for(const r of [p,s]) { r.ctx.shootingRef.current=true; r.send('pointerdown',20,30); }
  assert.deepEqual(plain(s.ctx.spinRequestRef.current),plain(p.ctx.spinRequestRef.current));
  for(const r of [p,s]) {r.cleanup(); assert.equal(r.handlers.size,0);assert.equal(r.frames.size,0);}
});
