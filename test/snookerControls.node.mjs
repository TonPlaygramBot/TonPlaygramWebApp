import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { clampBallInHand, projectPointerToSnookerTable } from '../webapp/src/games/snooker/ballInHand.ts';
import { normalizeSpinInput, mapSpinForPhysics } from '../webapp/src/pages/Games/snookerRoyalSpinUtils.js';

const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const definitions = new Map();
let placementCameraEffect;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name && node.init)
    definitions.set(node.id.name, source.slice(node.init.start, node.init.end));
  if (node.type === 'FunctionDeclaration') definitions.set(node.id.name, source.slice(node.start, node.end));
  if (node.type === 'CallExpression' && node.callee.name === 'useEffect' && node.arguments[0]?.type === 'ArrowFunctionExpression') {
    const effect = source.slice(node.arguments[0].start, node.arguments[0].end);
    if (effect.includes('inHandCameraRestoreRef.current = {')) placementCameraEffect = effect;
  }
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(walk);
    else if (child?.type) walk(child);
  }
}
walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
const install = (ctx, name) => ctx[name] = vm.runInContext(`(${definitions.get(name)})`, ctx);

test('spin stays neutral at centre and keeps all screen quadrants through repeated normalization', () => {
  for (const spin of [null, {}, { x: NaN, y: Infinity }, { x: 0, y: 0 }])
    assert.deepEqual(mapSpinForPhysics(spin), { x: 0, y: 0 });
  for (const x of [-.6, 0, .6]) for (const y of [-.6, 0, .6]) {
    let value = normalizeSpinInput({ x, y });
    const initial = { ...value };
    for (let frame = 0; frame < 120; frame++) value = normalizeSpinInput(value);
    assert.ok(Math.abs(value.x - initial.x) < 1e-12 && Math.abs(value.y - initial.y) < 1e-12);
    const expected = mapSpinForPhysics(value);
    assert.equal(Math.sign(expected.x), Math.sign(x));
    assert.equal(Math.sign(expected.y), Math.sign(y));
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      assert.deepEqual(mapSpinForPhysics(value, {
        cameraRight: new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading)),
        cameraUp: new THREE.Vector3(0, 1, 0), cueForward: new THREE.Vector3(0, 0, 1)
      }), expected);
    }
  }
  let prior = 0;
  for (const y of [.121, .2, .33, .5, .66, .75]) {
    const next = mapSpinForPhysics({ x: 0, y }).y;
    assert.ok(next > prior && next <= .75); prior = next;
  }
});

test('spin legality uses the cue-ball surface, independently of the orbit camera', () => {
  const ctx = { THREE, BALL_R: 1, CUE_TIP_RADIUS: .08, SPIN_STUN_RADIUS: .12,
    RAIL_LIMIT_X: 49, RAIL_LIMIT_Y: 99, RAIL_HEIGHT: 1.3, uploadedTableMapping: null };
  vm.createContext(ctx); install(ctx, 'prepareSpinAxes'); install(ctx, 'checkSpinLegality2D');
  const cue = { pos: new THREE.Vector2() }, axes = ctx.prepareSpinAxes(new THREE.Vector2(0, 1));
  for (const x of [-.5, 0, .5]) for (const y of [-.5, 0, .5]) for (const view of [{ x: 0, y: -1 }, { x: 0, y: 1 }])
    assert.equal(ctx.checkSpinLegality2D(cue, { x, y }, [], { axes, view }).blocked, false);
  const front = { active: true, pos: new THREE.Vector2(0, 2.01) };
  const rear = { active: true, pos: new THREE.Vector2(0, -2.01) };
  assert.equal(ctx.checkSpinLegality2D(cue, { x: 0, y: .2 }, [front], { axes }).blocked, false);
  assert.equal(ctx.checkSpinLegality2D(cue, { x: 0, y: .2 }, [rear], { axes }).blocked, true);
});

const bounds = { limitX: 49, limitY: 99, baulkY: -55, dRadius: 20, fullTable: false };
test('ball-in-hand stays inside the complete baulk semicircle and table bounds', () => {
  for (const x of [-100, -30, -1, 0, 1, 30, 100]) for (const y of [-200, -65, -55, -54, 0, 200]) {
    const p = clampBallInHand({ x, y }, bounds);
    assert.ok(p.y <= bounds.baulkY);
    assert.ok(Math.hypot(p.x, p.y - bounds.baulkY) <= bounds.dRadius + 1e-10);
    assert.ok(Math.abs(p.x) <= bounds.limitX && Math.abs(p.y) <= bounds.limitY);
  }
  assert.deepEqual(clampBallInHand({ x: -500, y: 500 }, { ...bounds, fullTable: true }), { x: -49, y: 99 });
  assert.equal(clampBallInHand({ x: NaN, y: 0 }, bounds), null);
});

function projectionRig(scale = .65) {
  const world = new THREE.Group(); world.scale.setScalar(scale); world.position.set(3, -12, 7);
  const table = new THREE.Group(); table.position.y = 24; world.add(table);
  const camera = new THREE.PerspectiveCamera(66, 390 / 844, .01, 2000);
  camera.up.set(0, 0, 1); camera.position.set(3, 280, 7); camera.lookAt(3, 0, 7); camera.updateMatrixWorld(true);
  const rect = { left: 10, top: 20, width: 390, height: 844 };
  const screen = p => {
    const v = table.localToWorld(new THREE.Vector3(p.x, 1, p.y)).project(camera);
    return { clientX: rect.left + (v.x + 1) * rect.width / 2, clientY: rect.top + (1 - v.y) * rect.height / 2 };
  };
  return { world, table, camera, rect, screen };
}
test('portrait pointer projection round-trips the actual translated/scaled ball plane', () => {
  for (const scale of [.42, .65, 1, 1.2]) {
    const r = projectionRig(scale);
    for (const p of [{ x: 0, y: -55 }, { x: -25, y: 0 }, { x: 30, y: 70 }]) {
      const hit = projectPointerToSnookerTable(r.screen(p), r.rect, r.camera, r.table, 1);
      assert.ok(hit && hit.distanceTo(new THREE.Vector2(p.x, p.y)) < 1e-8);
    }
    assert.equal(projectPointerToSnookerTable({ clientX: -1, clientY: 0 }, r.rect, r.camera, r.table, 1), null);
  }
  const r = projectionRig(); r.camera.lookAt(3, 600, 7); r.camera.updateMatrixWorld(true);
  assert.equal(projectPointerToSnookerTable({ clientX: 205, clientY: 442 }, r.rect, r.camera, r.table, 1), null);
});

function placementRig() {
  const r = projectionRig();
  const cue = { active: false, pos: new THREE.Vector2(0, -70), vel: new THREE.Vector2(),
    mesh: new THREE.Object3D(), spin: new THREE.Vector2(), pendingSpin: new THREE.Vector2(), omega: new THREE.Vector3() };
  cue.mesh.position.set(0, 1, -70); r.table.add(cue.mesh);
  const c = { THREE, ...r, cue, balls: [cue], BALL_R: 1, BALL_CENTER_Y: 1, D_RADIUS: 20, baulkZ: -55,
    RAIL_LIMIT_X: 49, RAIL_LIMIT_Y: 99, uploadedTableMapping: null,
    clampBallInHand, allowFullTableInHand: () => false, allStopped: balls => balls.every(b => b.vel.lengthSq() === 0),
    hudRef: { current: { inHand: true, turn: 0, over: false } }, shooting: false,
    replayPlaybackRef: { current: false }, inHandPlacementModeRef: { current: true },
    cueBallPlacedFromHandRef: { current: false }, autoAimRequestRef: { current: false },
    activeRenderCameraRef: { current: r.camera },
    dom: { getBoundingClientRect: () => r.rect, setPointerCapture() {}, releasePointerCapture() {} },
    setHud(value) { c.hudRef.current = value; }, setInHandPlacementMode(value) { c.inHandPlacementModeRef.current = value; },
    project: e => projectPointerToSnookerTable(e, r.rect, r.camera, r.table, 1) };
  vm.createContext(c);
  c.inHandDrag = vm.runInContext(`(${definitions.get('inHandDrag')})`, c);
  for (const name of ['isSpotFree', 'clampInHandPosition', 'updateCuePlacement', 'resolveNearestFreeInHandSpot',
    'tryUpdatePlacement', 'handleInHandDown', 'handleInHandMove', 'endInHandDrag']) install(c, name);
  const event = (point, type = 'pointerdown', pointerId = 1) => ({ ...r.screen(point), type, pointerId, isPrimary: true, button: 0, preventDefault() {} });
  return { c, cue, event };
}
test('tap-to-place and drag-to-place commit only the owned final position', () => {
  const { c, cue, event } = placementRig();
  const target = { x: 15, y: -57 };
  c.handleInHandDown(event(target));
  assert.equal(c.inHandDrag.active, true);
  c.endInHandDrag(event(target, 'pointerup', 2));
  assert.equal(c.hudRef.current.inHand, true, 'second finger cannot release the drag');
  c.endInHandDrag(event(target, 'pointerup'));
  assert.equal(c.hudRef.current.inHand, false);
  assert.equal(c.cueBallPlacedFromHandRef.current, true);
  assert.equal(cue.active, true);
});
test('cancel, lost capture, outside release and opponent turns never commit placement', () => {
  for (const type of ['pointercancel', 'lostpointercapture', 'outside']) {
    const { c, cue, event } = placementRig();
    const start = cue.pos.clone(); c.handleInHandDown(event(start));
    c.handleInHandMove(event({ x: 10, y: -60 }, 'pointermove'));
    c.endInHandDrag(type === 'outside' ? { ...event(start, 'pointerup'), clientX: -1 } : event(start, type));
    assert.equal(c.hudRef.current.inHand, true);
    assert.equal(c.cueBallPlacedFromHandRef.current, false);
    assert.ok(cue.pos.distanceTo(start) < 1e-9);
  }
  const { c, event } = placementRig();
  c.hudRef.current.turn = 1; c.handleInHandDown(event({ x: 0, y: -65 }));
  assert.equal(c.inHandDrag.active, false);
});

test('placement cannot overlap an object ball', () => {
  const { c, cue } = placementRig();
  const object = { active: true, pos: new THREE.Vector2(0, -60), vel: new THREE.Vector2() };
  c.balls.push(object);
  assert.equal(c.tryUpdatePlacement(object.pos, true), true);
  assert.ok(cue.pos.distanceTo(object.pos) > 2);
});

test('placement overview returns the exact prior camera bounds, focus and view mode', () => {
  for (const top of [false, true]) {
    const camera = new THREE.PerspectiveCamera(66);
    const c = { hud: { inHand: true, turn: 0, over: false }, replayActive: false,
      sphRef: { current: { radius: 42, phi: 1.1, theta: .4 } },
      cameraRef: { current: camera }, inHandCameraRestoreRef: { current: null },
      cameraBlendRef: { current: .35 }, topViewRef: { current: top }, topViewLockedRef: { current: top },
      overheadBroadcastVariantRef: { current: 'rail' },
      cameraBoundsRef: { current: { standing: { phi: 1, radius: 90 }, cueShot: { phi: 1.2, radius: 20 } } },
      orbitRadiusLimitRef: { current: 92 }, lowViewSlideRef: { current: 4 },
      orbitFocusRef: { current: { ballId: 'cue', target: new THREE.Vector3(1, 2, 3) } },
      lastCameraTargetRef: { current: new THREE.Vector3(4, 5, 6) },
      cancelCameraBlendTween() {}, setIsTopDownView(v) { c.topUi = v; }, cameraUpdateRef: { current() {} },
      topViewControlsRef: { current: { enter() {
        c.topViewRef.current = true; c.topViewLockedRef.current = true;
        c.sphRef.current.radius = 200; c.sphRef.current.theta = Math.PI;
        c.cameraBlendRef.current = 1; c.cameraBoundsRef.current = null;
        c.orbitRadiusLimitRef.current = 222; c.lowViewSlideRef.current = 0;
        c.lastCameraTargetRef.current.set(0, 0, 0);
      } } }
    };
    const oldBounds = c.cameraBoundsRef.current;
    vm.createContext(c); const effect = vm.runInContext(`(${placementCameraEffect})`, c);
    effect(); assert.equal(c.topUi, true);
    c.hud.inHand = false; effect();
    assert.equal(c.topViewRef.current, top); assert.equal(c.topUi, top);
    assert.deepEqual(c.sphRef.current, { radius: 42, phi: 1.1, theta: .4 });
    assert.equal(c.cameraBoundsRef.current, oldBounds);
    assert.equal(c.orbitRadiusLimitRef.current, 92);
    assert.equal(c.lowViewSlideRef.current, 4);
    assert.equal(c.cameraBlendRef.current, .35);
    assert.deepEqual(c.orbitFocusRef.current.target.toArray(), [1, 2, 3]);
    assert.deepEqual(c.lastCameraTargetRef.current.toArray(), [4, 5, 6]);
    assert.equal(c.inHandCameraRestoreRef.current, null);
  }
});
