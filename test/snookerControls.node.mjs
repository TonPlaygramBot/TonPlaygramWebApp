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
let preparePlacementView;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name && node.init)
    definitions.set(node.id.name, source.slice(node.init.start, node.init.end));
  if (node.type === 'FunctionDeclaration') definitions.set(node.id.name, source.slice(node.start, node.end));
  if (node.type === 'AssignmentExpression' && node.left.object?.name === 'prepareInHandViewRef' && node.right.type === 'ArrowFunctionExpression')
    preparePlacementView = source.slice(node.right.start, node.right.end);
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

test('ball-in-hand preserves every legal point on the snooker D boundary', () => {
  const boundary = [
    { x: -bounds.dRadius, y: bounds.baulkY },
    { x: 0, y: bounds.baulkY - bounds.dRadius },
    { x: bounds.dRadius, y: bounds.baulkY }
  ];
  for (const point of boundary) {
    assert.deepEqual(clampBallInHand(point, bounds), point);
  }
  assert.deepEqual(
    clampBallInHand({ x: 0, y: bounds.baulkY + 1 }, bounds),
    { x: 0, y: bounds.baulkY },
    'a touch visually above the baulk line clamps to the line, not outside the D'
  );
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

test('placement keeps the selected 3D or overhead view and clears a moving aim target', () => {
  for (const top of [false, true]) {
    const focus = { ballId: 'cue', target: new THREE.Vector3() };
    const c = { activeHumanCueViewRef: { current: {} }, aimFocusRef: { current: {} },
      topViewRef: { current: top }, TABLE_Y: 0, BALL_CENTER_Y: 1, baulkZ: -55,
      ensureOrbitFocus: () => focus, cancelCameraBlendTween() {},
      sph: { theta: 0, phi: 0 }, STANDING_VIEW_PHI: 1.04,
      applyCameraBlend: value => c.blend = value, updateCamera() {} };
    vm.createContext(c);
    vm.runInContext(`(${preparePlacementView})`, c)();
    assert.equal(c.topViewRef.current, top);
    assert.equal(c.blend, top ? undefined : 1);
    assert.equal(focus.ballId, null);
    assert.equal(c.activeHumanCueViewRef.current, null);
  }
});

test('Pool-style frame entitlement permits repeated placement before a shot', () => {
  const { c, cue, event } = placementRig();
  c.canRepositionCueBall = true;
  c.shootingRef = { current: false };
  c.prepareInHandViewRef = { current() {} };
  c.setHud = value => { c.hudRef.current = typeof value === 'function' ? value(c.hudRef.current) : value; };
  // The production callback is stored as useCallback(callback, deps).
  const callback = definitions.get('handleCueBallReposition');
  c.useCallback = fn => fn;
  c.handleCueBallReposition = vm.runInContext(callback, c);
  for (const x of [-12, 0, 12]) {
    c.handleCueBallReposition();
    c.handleInHandDown(event(cue.pos));
    c.handleInHandMove(event({ x, y: -60 }, 'pointermove'));
    c.endInHandDrag(event({ x, y: -60 }, 'pointerup'));
    assert.equal(c.hudRef.current.inHand, false);
    assert.equal(c.cueBallPlacedFromHandRef.current, true);
    assert.ok(Math.abs(cue.pos.x - x) < 1e-8);
  }
  c.shootingRef.current = true;
  c.handleCueBallReposition();
  assert.equal(c.hudRef.current.inHand, false, 'shooting closes placement');
  c.shootingRef.current = false; c.canRepositionCueBall = false;
  c.handleCueBallReposition();
  assert.equal(c.hudRef.current.inHand, false, 'no entitlement on an ordinary turn');
});
