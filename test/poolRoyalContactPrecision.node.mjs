import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import { resolvePoolRoyalCushionSpin } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import { resolvePoolRoyaleShotPowerScale } from '../webapp/src/pages/Games/poolRoyaleShotState.js';

// Exercise the actual JSX functions and collision loop without WebGL/Telegram.
// No copy of the game's impulse or frame-step implementation lives in this test.
const source = fs.readFileSync(new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (!value || typeof value !== 'object') continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findNode(child, predicate);
      if (found) return found;
    }
  }
  return null;
}
function load(name, scope = {}) {
  const node = findNode(ast, item =>
    ['FunctionDeclaration', 'VariableDeclarator'].includes(item.type) && item.id?.name === name);
  assert.ok(node, `Live JSX declaration ${name} exists`);
  const expression = node.type === 'VariableDeclarator' ? node.init : node;
  return new Function(...Object.keys(scope), `return (${source.slice(expression.start, expression.end)});`)(...Object.values(scope));
}
const radius = 0.05;
const scope = { THREE, BALL_R: radius, clamp: (value, min, max) => Math.max(min, Math.min(max, value)) };
for (const name of ['BALL_MASS', 'BALL_INERTIA', 'BALL_CONTACT_EPS', 'BALL_COLLISION_SLOP',
  'BALL_BALL_FRICTION', 'PHYSICS_PROFILE', 'PHYSICS_BASE_STEP', 'MAX_FRAME_SCALE', 'MIN_FRAME_SCALE',
  'MAX_PHYSICS_SUBSTEPS', 'DEFAULT_CUSHION_RESTITUTION', 'RAIL_FRICTION',
  'CUSHION_CUT_RESTITUTION_SCALE', 'CUSHION_CUT_FRICTION_SCALE']) scope[name] = load(name, scope);
const pairLoop = findNode(ast, node => node.type === 'ForStatement' && node.body?.type === 'ForStatement' &&
  source.slice(node.start, node.end).includes('const normalImpulseMag'));
assert.ok(pairLoop, 'Live ball-pair collision loop exists');
const pairSource = source.slice(pairLoop.start, pairLoop.end);

function ball(id, x, y = 0, vx = 0, vy = 0) {
  return { id, active: true, pos: new THREE.Vector2(x, y), vel: new THREE.Vector2(vx, vy),
    omega: new THREE.Vector3(), impacted: false };
}
function contact(balls) {
  const vectors = { TMP_VEC2_A: new THREE.Vector2() };
  for (const suffix of 'ABCDEFGH') vectors[`TMP_VEC3_${suffix}`] = new THREE.Vector3();
  const context = { current: { contactMade: false } };
  const sounds = [];
  const environment = { ...scope, ...vectors, balls,
    newCollisions: new Set(), prevCollisions: new Set(), shotRecording: null,
    shotContextRef: context, shotPrediction: null, activeShotView: null,
    lastShotPower: 1, BALL_COLLISION_SOUND_REFERENCE_SPEED: 1,
    playBallHit: value => sounds.push(value) };
  const firstHit = new Function(...Object.keys(environment), `let firstHit = null; ${pairSource}; return firstHit;`)(...Object.values(environment));
  return { firstHit, contactMade: context.current.contactMade, sounds };
}
const energy = balls => balls.reduce((sum, b) => sum + scope.BALL_MASS * b.vel.lengthSq() / 2 +
  scope.BALL_INERTIA * b.omega.lengthSq() / 2, 0);

test('stationary overlapping balls receive position repair without a shot-contact event or sound', () => {
  const balls = [ball('cue', 0), ball('ball_1', radius * 1.99)];
  const before = balls[0].pos.distanceTo(balls[1].pos);
  const result = contact(balls);
  assert.equal(result.firstHit, null);
  assert.equal(result.contactMade, false);
  assert.equal(result.sounds.length, 0);
  assert.equal(balls[0].impacted, false);
  assert.ok(balls[0].pos.distanceTo(balls[1].pos) > before);
  assert.equal(energy(balls), 0);
});

test('separating balls do not create another first-contact event or lose momentum', () => {
  const balls = [ball('cue', 0, 0, -0.4), ball('ball_1', radius * 1.999, 0, 0.7)];
  const before = balls.map(b => b.vel.toArray());
  const result = contact(balls);
  assert.equal(result.firstHit, null);
  assert.equal(result.contactMade, false);
  assert.equal(result.sounds.length, 0);
  assert.deepEqual(balls.map(b => b.vel.toArray()), before);
});

test('visible near misses outside numerical contact tolerance do not hit an enlarged invisible ball', () => {
  // This gap was inside the old 0.012R contact shell.
  const balls = [ball('cue', 0, 0, 1), ball('ball_1', radius * 2.005)];
  const before = balls.map(b => b.pos.toArray());
  const result = contact(balls);
  assert.equal(result.firstHit, null);
  assert.equal(result.contactMade, false);
  assert.equal(result.sounds.length, 0);
  assert.equal(balls[1].vel.length(), 0);
  assert.deepEqual(balls.map(b => b.pos.toArray()), before);
});

test('a closing center hit transfers momentum, records the real target and dissipates energy', () => {
  const balls = [ball('cue', 0, 0, 1), ball('ball_1', radius * 2)];
  const beforeEnergy = energy(balls);
  const result = contact(balls);
  assert.equal(result.firstHit, 'ball_1');
  assert.equal(result.contactMade, true);
  assert.equal(balls[0].impacted, true);
  assert.equal(result.sounds.length, 1);
  assert.ok(Math.abs(balls[0].vel.x + balls[1].vel.x - 1) < 1e-12);
  assert.ok(balls[1].vel.x > 0.98 && balls[0].vel.x < 0.02);
  assert.ok(energy(balls) < beforeEnergy && energy(balls) > beforeEnergy * 0.96);
});

test('oblique contacts preserve total planar momentum and never generate collision energy', () => {
  for (const heading of [0, Math.PI / 5, Math.PI / 2, Math.PI, -Math.PI / 3]) {
    const normal = new THREE.Vector2(Math.cos(heading), Math.sin(heading));
    const tangent = new THREE.Vector2(-normal.y, normal.x);
    const incoming = normal.clone().addScaledVector(tangent, 0.45);
    const balls = [ball('cue', 0, 0, incoming.x, incoming.y),
      ball('ball_1', normal.x * radius * 2, normal.y * radius * 2)];
    const beforeEnergy = energy(balls);
    const result = contact(balls);
    assert.equal(result.firstHit, 'ball_1');
    assert.ok(balls[0].vel.clone().add(balls[1].vel).distanceTo(incoming) < 1e-12);
    assert.ok(energy(balls) <= beforeEnergy + 1e-12);
  }
});

test('pocketed balls never participate in live contact or rule events', () => {
  const balls = [ball('cue', 0, 0, 1), { ...ball('ball_1', radius * 2), active: false }];
  const result = contact(balls);
  assert.equal(result.firstHit, null);
  assert.equal(balls[0].vel.x, 1);
  assert.equal(balls[1].vel.x, 0);
});

const frameStep = load('resolvePoolRoyalPhysicsFrameStep', scope);
test('frame integration adds bounded contact steps for fast opposing balls without speeding simulation time', () => {
  const elapsed = 1000 / 60;
  const slow = frameStep(elapsed, [ball('cue', 0)]);
  const fast = frameStep(elapsed, [ball('cue', 0, 0, radius * 0.7), ball('ball_1', 1, 0, -radius * 0.8)]);
  assert.equal(slow.physicsSubsteps, 1);
  assert.ok(fast.physicsSubsteps >= 6);
  assert.ok(fast.physicsSubsteps <= scope.MAX_PHYSICS_SUBSTEPS);
  assert.ok((radius * 1.5) * fast.subStepScale <= radius * 0.25 + 1e-12);
  assert.ok(Math.abs(fast.subStepScale * fast.physicsSubsteps - fast.frameScale) < 1e-12);
  assert.equal(fast.frameScale, slow.frameScale);
  assert.equal(frameStep(elapsed, [{ ...ball('cue', 0, 0, 1000), active: false }]).physicsSubsteps, 1);
});

test('slow-phone catch-up and invalid velocity inputs remain bounded', () => {
  const state = frameStep(500, [ball('cue', 0, 0, 1000), ball('ball_1', 1, 0, NaN)]);
  assert.equal(state.frameScale, scope.MAX_FRAME_SCALE);
  assert.equal(state.physicsSubsteps, scope.MAX_PHYSICS_SUBSTEPS);
  assert.ok(Number.isFinite(state.subStepScale));
});

test('actual rail wrapper returns slightly softer rebounds for rails and jaws', () => {
  assert.equal(scope.DEFAULT_CUSHION_RESTITUTION, 0.96);
  const apply = load('applyRailImpulse', { ...scope, resolvePoolRoyalCushionSpin,
    CUSHION_RESTITUTION: scope.DEFAULT_CUSHION_RESTITUTION });
  for (const type of ['rail', 'jaw', 'cut']) {
    const b = ball('cue', 0, 0, 1);
    apply(b, { type, normal: new THREE.Vector2(-1, 0), preImpactVel: b.vel.clone() });
    assert.ok(Math.abs(b.vel.x + 0.96) < 1e-12, type);
    assert.ok(Math.abs(b.vel.y) < 1e-12);
  }
});

test('the live shot-speed tuning adds modest power without changing the slider curve or break ratio', () => {
  const powerScope = {};
  for (const name of ['SHOT_POWER_REDUCTION', 'SHOT_POWER_MULTIPLIER', 'SHOT_POWER_INCREASE',
    'SHOT_POWER_ADJUSTMENT', 'SHOT_POWER_BOOST', 'SHOT_GLOBAL_POWER_SCALE', 'SHOT_FORCE_BOOST',
    'SHOT_BREAK_MULTIPLIER', 'SHOT_BASE_SPEED', 'SHOT_MIN_FACTOR', 'SHOT_POWER_RANGE']) powerScope[name] = load(name, powerScope);
  assert.equal(powerScope.SHOT_GLOBAL_POWER_SCALE, 0.98);
  assert.equal(powerScope.SHOT_BREAK_MULTIPLIER, 1.5);
  const previousForce = load('SHOT_FORCE_BOOST', { ...powerScope, SHOT_GLOBAL_POWER_SCALE: 0.93 });
  const previousBase = load('SHOT_BASE_SPEED', { ...powerScope, SHOT_FORCE_BOOST: previousForce });
  for (const power of [0.02, 0.25, 0.5, 0.8, 1]) {
    const multiplier = powerScope.SHOT_MIN_FACTOR + powerScope.SHOT_POWER_RANGE * resolvePoolRoyaleShotPowerScale(power);
    const currentSpeed = powerScope.SHOT_BASE_SPEED * multiplier;
    const previousSpeed = previousBase * multiplier;
    assert.ok(Math.abs(currentSpeed / previousSpeed - 0.98 / 0.93) < 1e-12);
  }
});

function scalingFixture() {
  const sizing = { ...scope };
  for (const name of ['WIDTH_REF', 'BALL_D_REF', 'BALL_SIZE_SCALE', 'TARGET_RATIO',
    'CORNER_MOUTH_REF', 'SIDE_MOUTH_REF', 'TABLE_SURFACE_REFERENCE', 'TABLE_SURFACE_EXPANSION',
    'TABLE_SURFACE_COMPENSATION', 'BALL_SEGMENTS', 'BALL_GEOMETRY']) sizing[name] = load(name, sizing);
  // Preserve the game's distinct visible table expansion and canonical ball
  // conversion. Previously this real wrapper re-derived an inflated radius.
  const mmToUnits = radius * 2 / (sizing.BALL_D_REF * sizing.BALL_SIZE_SCALE) * sizing.TABLE_SURFACE_COMPENSATION;
  sizing.innerLong = sizing.WIDTH_REF * mmToUnits;
  sizing.innerShort = sizing.innerLong / sizing.TARGET_RATIO;
  Object.assign(sizing, {
    POCKET_CORNER_MOUTH_SCALE: 1, POCKET_SIDE_MOUTH_SCALE: 1,
    POCKET_VIS_R: sizing.CORNER_MOUTH_REF * mmToUnits / 2,
    SIDE_POCKET_RADIUS: sizing.SIDE_MOUTH_REF * mmToUnits / 2,
    POCKET_MOUTH_TOLERANCE: 1e-9
  });
  return { sizing, apply: load('applySnookerScaling', sizing) };
}

test('actual post-rack scaling keeps displayed spheres exactly the same radius as ball contacts', () => {
  const { sizing, apply } = scalingFixture();
  const material = new THREE.MeshBasicMaterial();
  const alternateGeometry = new THREE.SphereGeometry(radius * 0.5, 16, 12);
  const balls = [
    { mesh: new THREE.Mesh(sizing.BALL_GEOMETRY, material) },
    { mesh: new THREE.Mesh(alternateGeometry, material) },
    { mesh: null }
  ];
  balls[0].mesh.scale.setScalar(sizing.TABLE_SURFACE_COMPENSATION);
  for (let repeat = 0; repeat < 3; repeat++) {
    apply({ tableInnerRect: { width: sizing.innerLong, height: sizing.innerShort }, balls });
    for (const b of balls) {
      assert.equal(b.colliderRadius, radius);
      if (!b.mesh) continue;
      for (const axis of ['x', 'y', 'z']) {
        assert.ok(Math.abs(b.mesh.geometry.parameters.radius * b.mesh.scale[axis] - radius) < 1e-12);
      }
    }
  }
  assert.equal(balls[0].mesh.scale.x, 1, 'normal game sphere never receives table surface expansion');
  balls[0].mesh.position.x = 0;
  balls[1].mesh.position.x = radius * 2;
  const rightEdge = balls[0].mesh.position.x + balls[0].mesh.geometry.parameters.radius * balls[0].mesh.scale.x;
  const leftEdge = balls[1].mesh.position.x - balls[1].mesh.geometry.parameters.radius * balls[1].mesh.scale.x;
  assert.ok(Math.abs(rightEdge - leftEdge) < 1e-12, 'physically touching balls visually touch without overlap');
  sizing.BALL_GEOMETRY.dispose();
  alternateGeometry.dispose();
  material.dispose();
});

test('actual ball geometry and center height rest exactly on the cloth without a floating gap', () => {
  const { sizing, apply } = scalingFixture();
  Object.assign(sizing, { RAIL_HEIGHT: radius * 3.7, FRAME_TOP_Y: -radius * 1.2 });
  for (const name of ['CLOTH_LIFT', 'CLOTH_TOP_LOCAL', 'CLOTH_DROP', 'BALL_CENTER_LIFT', 'BALL_CENTER_Y']) {
    sizing[name] = load(name, sizing);
  }
  assert.equal(sizing.BALL_CENTER_LIFT, 0);
  const material = new THREE.MeshBasicMaterial();
  const b = { mesh: new THREE.Mesh(sizing.BALL_GEOMETRY, material) };
  b.mesh.position.y = sizing.BALL_CENTER_Y;
  apply({ balls: [b] });
  const visibleBottom = b.mesh.position.y - b.mesh.geometry.parameters.radius * b.mesh.scale.y;
  const clothSurface = sizing.CLOTH_TOP_LOCAL + sizing.CLOTH_LIFT - sizing.CLOTH_DROP;
  assert.ok(Math.abs(visibleBottom - clothSurface) < 1e-12);
  assert.equal(b.colliderRadius, b.mesh.geometry.parameters.radius * b.mesh.scale.y);
  sizing.BALL_GEOMETRY.dispose();
  material.dispose();
});
