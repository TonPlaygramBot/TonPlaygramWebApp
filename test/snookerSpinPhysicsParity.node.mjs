import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import * as spin from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

function game(file) {
  const source = fs.readFileSync(new URL(`../webapp/src/pages/Games/${file}.jsx`, import.meta.url), 'utf8');
  const definitions = new Map();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration') definitions.set(node.id.name, source.slice(node.start, node.end));
    if (node.type === 'VariableDeclarator' && node.id?.name && node.init)
      definitions.set(node.id.name, source.slice(node.init.start, node.init.end));
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk); else if (value?.type) walk(value);
    }
  }
  walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  const scope = { ...spin, THREE, BALL_R: .05, clamp: (x, min, max) => Math.max(min, Math.min(max, x)) };
  function load(name) {
    assert.ok(definitions.has(name), name);
    return new Function(...Object.keys(scope), `return (${definitions.get(name)});`)(...Object.values(scope));
  }
  for (const name of ['SPIN_FIXED_DT', 'SPIN_KINETIC_FRICTION', 'ROLLING_RESISTANCE', 'SPIN_GRAVITY',
    'SPIN_ANGULAR_DAMPING', 'STOP_EPS', 'STOP_SOFTENING', 'STOP_FINAL_EPS', 'RAIL_FRICTION',
    'CUSHION_CUT_RESTITUTION_SCALE', 'CUSHION_CUT_FRICTION_SCALE']) scope[name] = load(name);
  scope.CUSHION_RESTITUTION = .96;
  return { source, definitions, scope, step: load('stepPoolRoyalBallMotion'), rail: load('applyRailImpulse'), stopped: load('allStopped') };
}
const pool = game('PoolRoyale'), snooker = game('SnookerRoyal');
function ball(offset, speed = .3) {
  const strike = spin.resolvePoolRoyalCueStrike({ spin: offset, direction: { x: .6, y: .8 }, speed, radius: .05 });
  return { id: 'cue', active: true, pos: new THREE.Vector2(), vel: new THREE.Vector2(strike.velocity.x, strike.velocity.y),
    omega: new THREE.Vector3(strike.omega.x, strike.omega.y, strike.omega.z), spin: new THREE.Vector2(offset.x, offset.y), pendingSpin: new THREE.Vector2() };
}
const snapshot = b => [b.pos.toArray(), b.vel.toArray(), b.omega.toArray()];
test('Snooker executes the same cloth and cushion adapter functions as Pool', () => {
  for (const name of ['stepPoolRoyalBallMotion', 'applyRailImpulse', 'allStopped'])
    assert.equal(snooker.definitions.get(name), pool.definitions.get(name));
  for (const name of Object.keys(pool.scope)) if (typeof pool.scope[name] === 'number')
    assert.equal(snooker.scope[name], pool.scope[name], name);
});
test('center, follow, draw and diagonal spin trajectories match across frame subdivisions', () => {
  for (const offset of [{x:0,y:0}, {x:0,y:.75}, {x:0,y:-.75}, {x:.4,y:-.5}, {x:-.6,y:.3}]) {
    for (const scale of [.25, .5, 1, 2]) {
      const a = ball(offset), b = ball(offset);
      for (let step = 0; step < 300; step++) {
        pool.step(a, scale); snooker.step(b, scale);
        assert.deepEqual(snapshot(b), snapshot(a));
        assert.equal(snooker.stopped([b]), pool.stopped([a]));
      }
    }
  }
});
test('draw/follow resumes after a stopped collision while pure sidespin cannot keep a frame open', () => {
  for (const y of [-.75,.75]) {
    const b = ball({x:0,y}); b.vel.set(0,0);
    assert.equal(snooker.stopped([b]), false);
    snooker.step(b,.5); assert.ok(b.vel.length() > 0);
  }
  const b = ball({x:.75,y:0}); b.vel.set(0,0);
  assert.equal(snooker.stopped([b]), true);
});
test('rail and cut contacts preserve matching spin-dependent rebound', () => {
  for (const side of [-.75,0,.75]) for (const type of ['rail','cut','corner']) {
    const a = ball({x:side,y:.2}), b = ball({x:side,y:.2});
    const impact = {type, normal:new THREE.Vector2(0,-1), preImpactVel:a.vel.clone()};
    pool.rail(a,impact); snooker.rail(b,impact);
    assert.deepEqual(snapshot(b), snapshot(a));
    assert.ok(Number.isFinite(b.omega.length()));
  }
});
test('live Snooker strike initializes shared angular momentum and does not suppress first-contact spin', () => {
  assert.match(snooker.source, /const strike = resolvePoolRoyalCueStrike\(\{/);
  assert.match(snooker.source, /cue\.omega\?\.set\(strike\.omega\.x, strike\.omega\.y, strike\.omega\.z\)/);
  assert.doesNotMatch(snooker.source, /cueSpinSuppressed|applySpinController\(|applyRailSpinResponse\(/);
});
