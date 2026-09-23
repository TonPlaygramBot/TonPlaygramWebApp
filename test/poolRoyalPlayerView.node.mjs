import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { resolvePoolRoyalAddressState } from '../webapp/src/pages/Games/shared/poolRoyalAddress.ts';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { SnookerRoyalShotCamera } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';
import { PoolRoyalPlayerCamera, applyPoolRoyalPlayerView } from '../webapp/src/pages/Games/shared/poolRoyalPlayerCamera.ts';
import { poolRoyalHudLayout, POOL_SPIN_DIAMETER_PX, POOL_AVATAR_SIZE_PX } from '../webapp/src/pages/Games/poolRoyalHudLayout.js';
import { normalizeSpinInput, spinFromScreenPoint, smoothDamp } from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';

// Execute the actual JSX call sites and native handlers without importing the
// entire authenticated app or replacing its renderer with a look-alike demo.
const source = await readFile(process.env.POOL_VIEW_SOURCE || new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
const nodes = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type) nodes.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }).program);
const text = node => source.slice(node.start, node.end);
const variable = name => nodes.find(node => node.type === 'VariableDeclarator' && node.id.name === name);
const evaluate = (node, context) => vm.runInNewContext(`(${text(node)})`, context);
const ref = current => ({ current });
const placementContext = () => ({ resolvePoolRoyalAddressState, stroke: null, ballsMoving: false,
  hudRef: ref({ inHand: true, over: false }), cueBallPlacedFromHandRef: ref(false),
  inHandPlacementModeRef: ref(true), inHandDragRef: ref({ active: false }), breakRollStateRef: ref('done') });
const addressCall = nodes.find(node => node.type === 'CallExpression' && node.callee.name === 'resolvePoolRoyalAddressState');

test('actual game addresses a placed cue ball before power changes, while preserving ball-in-hand rights', () => {
  const context = placementContext();
  assert.equal(evaluate(addressCall, context), 'idle');
  context.cueBallPlacedFromHandRef.current = true;
  context.inHandPlacementModeRef.current = false;
  assert.equal(evaluate(addressCall, context), 'dragging');
  assert.equal(context.hudRef.current.inHand, true, 'rules still allow repositioning');
  context.inHandDragRef.current.active = true;
  assert.equal(evaluate(addressCall, context), 'idle', 'a new drag releases the stance');
});

test('accepting a full-table ball-in-hand spot cannot deadlock the shot preparation queue', () => {
  const fire = variable('fire').init;
  const commit = fire.body.body.find(node => node.type === 'IfStatement' &&
    text(node.test) === 'fullTableHandPlacement && currentHud?.inHand');
  assert.ok(commit, 'commit the accepted spot before the readiness gate');
  const gate = fire.body.body.find(node => node.type === 'IfStatement' && text(node.test) === '!isHumanReadyForShot()');
  assert.ok(commit.end < gate.start);
  const context = { ...placementContext(), fullTableHandPlacement: true, currentHud: { inHand: true }, setInHandPlacementMode() {} };
  vm.runInNewContext(text(commit), context);
  assert.equal(evaluate(addressCall, context), 'dragging');
});

test('the real 3D button exits Look and overhead modes on phone and desktop', () => {
  const button = nodes.find(node => node.type === 'JSXOpeningElement' && node.attributes.some(attr =>
    attr.name?.name === 'aria-label' && attr.value?.value === 'Switch to 3D view'));
  const click = button.attributes.find(attr => attr.name?.name === 'onClick').value.expression;
  for (const isPortrait of [false, true]) {
    const state = { look: true, rail: true, top: true, updates: 0 };
    const lookModeRef = ref(true);
    evaluate(click, { isPortrait, lookModeRef, setIsLookMode: v => state.look = v,
      setIsRailOverheadView: v => state.rail = v, setIsTopDownView: v => state.top = v,
      topViewControlsRef: ref({ exit: () => state.top = false }),
      cameraUpdateRef: ref(() => state.updates++) })();
    assert.equal(lookModeRef.current, false);
    assert.deepEqual(state, { look: false, rail: false, top: false, updates: 1 });
  }
});

test('the final JSX render camera stays between the real eyes throughout address and walking, for both seats', async () => {
  const m = await readPoolRoyalMetrics();
  const world = new THREE.Group(); world.position.set(11, -4, 5); world.scale.setScalar(.23); world.rotation.y = .7;
  const players = new PoolRoyalHumanPlayers(world, { ...m, model: await loadPoseModel(), realisticMovement: true });
  assert.ok(await players.ready);
  const eyeRef = ref(null), topViewRef = ref(false);
  const resolveEye = evaluate(variable('resolveActiveHumanEyePose').init, {
    humanShotCamera: new PoolRoyalPlayerCamera(), activeHumanCueViewRef: eyeRef,
    cueAnimating: false, shotImpactPending: false, shootingRef: ref(false), cameraBlendRef: ref(0),
    performance: { now: () => 1000 }, topViewRef, lookModeRef: ref(false),
    replayPlaybackRef: ref(null), cueGalleryStateRef: ref(null), world
  });
  const overlay = variable('updateCamera').init.body.body.find(node =>
    node.type === 'IfStatement' && node.test.name === 'humanEyePose');
  assert.ok(overlay);
  const applyFinalCamera = vm.runInNewContext(`(renderCamera, lookTarget) => {
    const humanEyePose = resolveActiveHumanEyePose();
    ${text(overlay)}
    return { renderCamera, lookTarget };
  }`, { THREE, humanEyeCamera: new THREE.PerspectiveCamera(), resolveActiveHumanEyePose: resolveEye, applyPoolRoyalPlayerView });
  let movingFrames = 0;
  for (const activeSeat of ['A', 'B']) for (let frame = 0; frame < 180; frame++) {
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, frame > 90 ? .3 : 0);
    players.update(1 / 60, { activeSeat, state: 'dragging', power: 0, nowMs: frame * 16,
      cueBall: new THREE.Vector3(0, m.ballY, m.tableL * .31), aimForward: forward });
    eyeRef.current = players.eyeView;
    assert.ok(eyeRef.current, 'aiming never falls back to a camera outside the face');
    const human = players.players.find(p => p.seat === activeSeat).human;
    const middle = human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
      .lerp(human.model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), .5);
    const sourceCamera = new THREE.PerspectiveCamera(72, 390 / 844, .04, 4000);
    sourceCamera.position.set(50, 90, -60); sourceCamera.up.set(0, 0, 1); sourceCamera.zoom = 1.4;
    const final = applyFinalCamera(sourceCamera, new THREE.Vector3());
    assert.ok(final.renderCamera.position.distanceTo(middle) < 1e-8);
    assert.deepEqual(final.renderCamera.up.toArray(), [0, 1, 0]);
    assert.equal(final.renderCamera.zoom, 1);
    assert.equal(final.renderCamera.aspect, 390 / 844);
    assert.deepEqual(sourceCamera.position.toArray(), [50, 90, -60], 'broadcast source is untouched');
    final.renderCamera.updateMatrixWorld(true);
    const target = final.lookTarget.clone().project(final.renderCamera);
    assert.ok(Math.abs(target.x) < 1e-7 && Math.abs(target.y) < 1e-7);
    if (players.walking || human.poseT < .95) movingFrames++;
  }
  assert.ok(movingFrames > 30, 'exercise the transition that used to lose the eyes');
  topViewRef.current = true;
  assert.equal(resolveEye(), null, 'explicit overhead selection still works');
  players.dispose();
});

function cameraContext() {
  const world = new THREE.Group();
  world.scale.setScalar(.23); world.position.y = -2;
  const context = { THREE, world, humanShotCamera: new PoolRoyalPlayerCamera(), applyPoolRoyalPlayerView,
    activeHumanCueViewRef: ref({ position: new THREE.Vector3(3, 9, 14), target: new THREE.Vector3(0, 2, -4), blend: 1 }),
    cueAnimating: false, shooting: false, shootingRef: ref(false), shotImpactPending: false,
    cameraBlendRef: ref(0), topViewRef: ref(false), lookModeRef: ref(false),
    replayPlaybackRef: ref(null), cueGalleryStateRef: ref(null), now: 0 };
  context.performance = { now: () => context.now };
  context.resolveActiveHumanEyePose = evaluate(variable('resolveActiveHumanEyePose').init, context);
  return context;
}

test('Pool matches the preview regardless of orbit blend and preserves explicit views', () => {
  const c = cameraContext();
  for (const blend of [0, .2, .55, .94, 1]) {
    c.cameraBlendRef.current = blend;
    const expected = new SnookerRoyalShotCamera().resolve({ eye: c.activeHumanCueViewRef.current,
      stroke: false, shooting: false, impactPending: false, cueBlend: 0, now: 0 });
    const actual = c.resolveActiveHumanEyePose();
    assert.equal(actual?.blend, expected?.blend);
    if (actual) assert.ok(actual.position.distanceTo(c.world.localToWorld(expected.position.clone())) < 1e-9);
  }
  c.cameraBlendRef.current = 0;
  for (const [name, value] of [['topViewRef', true], ['lookModeRef', true],
    ['replayPlaybackRef', true], ['cueGalleryStateRef', { active: true }]]) {
    c[name].current = value;
    assert.equal(c.resolveActiveHumanEyePose(), null, name);
    c[name].current = null;
  }
});

test('the live impact callback holds the pre-shot view until 900 ms after contact', () => {
  const c = cameraContext();
  c.humanShotCamera.beginShot(c.activeHumanCueViewRef.current, c.activeHumanCueViewRef.current);
  c.shooting = c.shootingRef.current = c.cueAnimating = c.shotImpactPending = true;
  const address = c.resolveActiveHumanEyePose();
  c.activeHumanCueViewRef.current.position.set(100, -5, -70);
  c.now = 4500; // Long backswing: elapsed shot time must not start broadcast.
  assert.deepEqual(c.resolveActiveHumanEyePose(), address);
  let impacts = 0;
  Object.assign(c, { shotImpactApplied: false, shotImpactPayload: {}, powerImpactHoldRef: ref(0),
    SNOOKER_PLAYER_FOLLOW_THROUGH_MS: 900, applyShotAtImpact: () => impacts++ });
  const impact = evaluate(variable('applyShotImpactOnce').init, c);
  impact(); impact();
  assert.equal(impacts, 1);
  assert.equal(c.shotImpactPending, false);
  assert.equal(c.powerImpactHoldRef.current, 5400);
  c.cueAnimating = false;
  c.activeHumanCueViewRef.current = null; // Scratch/rig disappearance cannot move the held view.
  for (const now of [4500, 5000, 5399]) {
    c.now = now;
    assert.deepEqual(c.resolveActiveHumanEyePose(), address);
  }
  c.now = 5400;
  assert.equal(c.resolveActiveHumanEyePose(), null);
  assert.equal(c.humanShotCamera.isBroadcasting, true);
  c.shootingRef.current = false;
  c.resolveActiveHumanEyePose();
  assert.equal(c.humanShotCamera.isBroadcasting, false);
});

test('production render dispatch skips ball tracking during the held player view', () => {
  const c = cameraContext();
  c.humanShotCamera.beginShot(c.activeHumanCueViewRef.current, c.activeHumanCueViewRef.current);
  c.shooting = c.shootingRef.current = true;
  const body = variable('updateCamera').init.body.body;
  const index = body.findIndex(node => node.declarations?.[0]?.id.name === 'humanEyePose');
  const overlay = body.find(node => node.type === 'IfStatement' && node.test.name === 'humanEyePose');
  const camera = new THREE.PerspectiveCamera(72, 390 / 844, .01, 2000);
  camera.position.set(30, 60, -40);
  Object.assign(c, { camera, renderCamera: camera, lookTarget: null, broadcastArgs: {},
    humanEyeCamera: camera.clone(), STANDING_VIEW_FOV: 66 });
  Object.defineProperty(c, 'ballsRef', { get() { throw new Error('Held view must not read the moving ball'); } });
  vm.runInNewContext(text(body[index]) + text(body[index + 1]) + text(overlay), c);
  assert.ok(c.renderCamera.position.distanceTo(c.world.localToWorld(new THREE.Vector3(3, 9, 14))) < 1e-9);
  assert.deepEqual(camera.position.toArray(), [30, 60, -40], 'the broadcast camera keeps its own transform');
  assert.equal(c.renderCamera.fov, 66);
});

test('starting a shot locks state synchronously without an automatic overhead timer', () => {
  const c = cameraContext();
  let scheduled = 0;
  Object.assign(c, { shotStartedAt: 0, getNow: () => 100, maxPowerLiftTriggered: false,
    preShotTopViewRef: ref(false), preShotTopViewLockRef: ref(false), topViewLockedRef: ref(false),
    setShotActive() {}, exitTopView() {}, window: { setTimeout() { scheduled++; } } });
  const setShootingState = evaluate(variable('setShootingState').init, c);
  setShootingState(true);
  assert.equal(c.shootingRef.current, true);
  assert.equal(scheduled, 0);
  assert.equal(c.topViewRef.current, false);
  setShootingState(false);
  assert.equal(c.shootingRef.current, false);
});

test('rail and pocket events cannot preempt the held player camera', () => {
  const guards = nodes.filter(node => node.type === 'IfStatement' &&
    text(node.test) === '!humanShotCamera.isHoldingShot' && text(node.consequent).includes('enterTopView'));
  assert.equal(guards.length, 5);
  const c = cameraContext();
  let cuts = 0; c.enterTopView = () => cuts++;
  c.humanShotCamera.beginShot(c.activeHumanCueViewRef.current, c.activeHumanCueViewRef.current);
  for (const guard of guards) vm.runInNewContext(text(guard), c);
  assert.equal(cuts, 0);
  c.humanShotCamera.reset();
  for (const guard of guards) vm.runInNewContext(text(guard), c);
  assert.equal(cuts, 5);
});

test('avatar bounds reserve a clear spin lane at phone sizes and UI scales', () => {
  const outer = nodes.find(node => node.type === 'JSXOpeningElement' && node.attributes.some(attr =>
    attr.name?.name === 'className' && attr.value?.expression && text(attr.value.expression).includes('bottomHudLayoutClass')));
  assert.ok(outer);
  const className = evaluate(outer.attributes.find(a => a.name?.name === 'className').value.expression, {
    bottomHudLayoutClass: evaluate(variable('bottomHudLayoutClass').init, { usePortraitHudLayout: true }),
    pocketCameraActive: false, replayActive: false
  });
  assert.doesNotMatch(className, /\bw-full\b/, 'explicit full width would override the reserved right inset');
  assert.equal(text(outer.attributes.find(a => a.name?.name === 'style').value.expression), 'controlLayout.avatars');
  assert.equal(POOL_AVATAR_SIZE_PX, 40);
  for (const width of [320, 360, 390, 412, 844]) for (const uiScale of [.8, 1, 1.04, 1.2]) {
    const { avatars, spin } = poolRoyalHudLayout({ uiScale, portrait: width < 500, bottom: 56 });
    const spinLeft = width - spin.right - POOL_SPIN_DIAMETER_PX * uiScale * .88;
    const avatarRight = width - avatars.right;
    assert.ok(spinLeft - avatarRight >= 12 - 1e-8);
    assert.ok(avatarRight - avatars.left >= POOL_AVATAR_SIZE_PX * 2 + 16 + 8);
    assert.equal(spin.left, undefined, 'overhead does not move spin under the avatars');
  }
});

test('actual spin pointer handlers keep fixed bounds and preserve screen directions through release', () => {
  const effect = nodes.find(node => node.type === 'CallExpression' && node.callee.name === 'useEffect' &&
    node.arguments[0]?.type === 'ArrowFunctionExpression' && text(node.arguments[0]).includes("document.getElementById('spinBox')"));
  const handlers = new Map(), frames = new Map(); let id = 0;
  const style = { touchAction: '' };
  const rect = { left: 240, top: 600, width: 100, height: 100 };
  let captured = null;
  const box = { style, getBoundingClientRect: () => rect,
    addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name),
    setPointerCapture: value => captured = value, releasePointerCapture: () => captured = null };
  const spinRef = ref(null), spinRequestRef = ref(null);
  const cleanup = evaluate(effect.arguments[0], { showSpinController: true, showPlayerControls: true,
    document: { getElementById: name => name === 'spinBox' ? box : {} },
    spinDotElRef: ref(null), resetSpinRef: ref(null), spinRef, spinRequestRef,
    spinLegalityRef: ref(null), shootingRef: ref(false), cueStrokeStateRef: ref(null),
    normalizeSpinInput, spinFromScreenPoint, smoothDamp, updateSpinDotPosition() {},
    window: { setTimeout: () => 1 }, clearTimeout() {},
    requestAnimationFrame: cb => { frames.set(++id, cb); return id; }, cancelAnimationFrame: key => frames.delete(key)
  })();
  const event = (x, y) => ({ pointerId: 7, pointerType: 'touch', clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {} });
  for (const [x, y, expected] of [[290, 612.5, [0, .75]], [327.5, 650, [.75, 0]], [290, 687.5, [0, -.75]], [252.5, 650, [-.75, 0]]]) {
    handlers.get('pointerdown')(event(290, 650));
    assert.equal(captured, 7);
    handlers.get('pointermove')(event(x, y));
    handlers.get('pointerup')(event(x, y));
    assert.equal(captured, null);
    assert.deepEqual([spinRequestRef.current.x, spinRequestRef.current.y], expected);
    for (let frame = 0; frame < 90 && frames.size; frame++) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb((frame + 1) * 16));
    }
    assert.ok(Math.abs(spinRef.current.x - expected[0]) < .002 && Math.abs(spinRef.current.y - expected[1]) < .002);
    assert.equal(style.transform, undefined, 'drag cannot enlarge the dial into avatars or change hit coordinates');
  }
  cleanup(); assert.equal(handlers.size, 0);
});
