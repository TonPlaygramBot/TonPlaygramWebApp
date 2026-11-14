import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { SnookerRoyalShotCamera, SNOOKER_PLAYER_SHOT_FOV } from '../webapp/src/pages/Games/snookerRoyalShotCamera.ts';

// Exercise the actual avatar-free renderer and manual camera controls.
const m = { cameraFov: SNOOKER_PLAYER_SHOT_FOV };
const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const gameAst = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const callbacks = new Map();
const visit = node => {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') callbacks.set(node.id.name, node.init);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
};
visit(gameAst);

function cameraRig(world) {
  const context = {
    world,
    frameRef: { current: { activePlayer: 'A' } },
    localSeatRef: { current: 'A' },
    characterShotShooter: 'A',
    lookModeRef: { current: false },
    humanShotCamera: new SnookerRoyalShotCamera(),
    cueAnimating: false,
    shootingRef: { current: false },
    shotImpactPending: false,
    cameraBlendRef: { current: 0 },
    topViewRef: { current: false },
    replayPlaybackRef: { current: false },
    cueGalleryStateRef: { current: null },
    performance: { now: () => context.now },
    now: 0
  };
  vm.createContext(context);
  const resolver = callbacks.get('resolveActiveHumanEyePose');
  context.resolve = vm.runInContext(`(${source.slice(resolver.start, resolver.end)})`, context);
  return context;
}

test('the live render handoff skips tracking branches and renders the held player view', () => {
  const rig = cameraRig(new THREE.Group());
  const eye = { position: new THREE.Vector3(4, 20, 30), target: new THREE.Vector3(0, 4, 0), blend: 1 };
  rig.humanShotCamera.beginShot(eye, eye);
  rig.shootingRef.current = true;
  const camera = new THREE.PerspectiveCamera(90, 390 / 844, 0.01, 1000);
  const statements = callbacks.get('updateCamera').body.body;
  const index = statements.findIndex(s => s.declarations?.[0]?.id?.name === 'humanEyePose');
  assert.ok(index >= 0);
  const overlay = statements.find(s => s.type === 'IfStatement' && s.test?.name === 'humanEyePose');
  const handoff = source.slice(statements[index].start, statements[index + 1].end)
    + source.slice(overlay.start, overlay.end);
  for (const trackedBall of [new THREE.Vector3(50, 4, -30), new THREE.Vector3(-20, -10, 60)]) {
    camera.position.copy(trackedBall);
    const context = vm.createContext({
      renderCamera: camera, humanEyeCamera: camera.clone(), lookTarget: trackedBall, THREE,
      camera, shooting: true, cueAnimating: false, broadcastArgs: {},
      activeShotView: { mode: 'pocket', anchorType: 'side' },
      get ballsRef() { throw new Error('player view must skip the ball-tracking branches'); },
      resolveActiveHumanEyePose: rig.resolve, STANDING_VIEW_FOV: m.cameraFov
    });
    vm.runInContext(handoff, context);
    assert.deepEqual(context.renderCamera.position, eye.position);
    assert.equal(context.renderCamera.fov, m.cameraFov);
    assert.deepEqual(camera.position, trackedBall, 'source broadcast camera is not moved');
    context.renderCamera.updateMatrixWorld(true);
    const targetScreen = eye.target.clone().project(context.renderCamera);
    assert.ok(Math.abs(targetScreen.x) < 1e-8 && Math.abs(targetScreen.y) < 1e-8);
  }
});


test('explicit overhead bypasses legacy impact, action and pocket camera branches', () => {
  const statements = callbacks.get('updateCamera').body.body;
  const index = statements.findIndex(s => s.declarations?.[0]?.id?.name === 'humanEyePose');
  const chain = statements[index + 1];
  let genericBranch = chain;
  while (genericBranch.type === 'IfStatement') genericBranch = genericBranch.alternate;
  // Execute the production camera dispatch and legacy branches. Only the
  // unchanged generic orbit/overhead renderer is replaced with a sentinel.
  const dispatch = source.slice(chain.start, genericBranch.start) + '{ selectedOverhead = true; }';
  for (const mode of ['impact', 'action', 'pocket']) {
    const context = vm.createContext({
      humanEyePose: null, shooting: true, cueAnimating: false,
      replayPlaybackActive: false, galleryState: null,
      topViewRef: { current: true }, cameraHoldActive: mode === 'impact',
      cueImpactCameraRef: { current: {} }, activeShotView: { mode, anchorType: 'side' },
      get ballsRef() { throw new Error('manual overhead must skip the ball-tracking branches'); },
      selectedOverhead: false
    });
    vm.runInContext(dispatch, context);
    assert.equal(context.selectedOverhead, true, `${mode} cannot override explicit overhead`);
  }
});


test('starting a live shot no longer schedules an automatic overhead camera', () => {
  const scheduled = [];
  const c = {
    shooting: false, shootingRef: { current: false }, shotStartedAt: 0,
    getNow: () => 100, shotImpactPending: true, shotImpactFallbackTimer: null,
    maxPowerLiftTriggered: false, cueImpactCameraRef: { current: null },
    preShotTopViewRef: { current: false }, preShotTopViewLockRef: { current: false },
    topViewRef: { current: false }, topViewLockedRef: { current: false },
    shotCameraHoldTimeoutRef: { current: null }, SHOT_CAMERA_HOLD_MS: 2000,
    window: { setTimeout: (callback, delay) => scheduled.push({ callback, delay }) },
    clearTimeout() {}, enterTopView() { c.topViewRef.current = true; },
    exitTopView() { c.topViewRef.current = false; }, setShotActive() {}
  };
  vm.createContext(c);
  const node = callbacks.get('setShootingState');
  const setShootingState = vm.runInContext(`(${source.slice(node.start, node.end)})`, c);
  setShootingState(true);
  assert.equal(c.shootingRef.current, true);
  assert.equal(scheduled.length, 0, 'the shot-camera owner controls the broadcast handoff');
  assert.equal(c.topViewRef.current, false);
  setShootingState(false);
  assert.equal(c.shootingRef.current, false);
});


test('Snooker 3D button exits Look and overhead modes immediately', () => {
  let button;
  const find = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement' && node.attributes.some(attr =>
      attr.name?.name === 'aria-label' && attr.value?.value === 'Switch to 3D view')) button = node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(find);
      else if (value?.type) find(value);
    }
  };
  find(gameAst);
  const click = button.attributes.find(attr => attr.name?.name === 'onClick').value.expression;
  const state = { look: true, rail: true, top: true, updates: 0 };
  const lookModeRef = { current: true };
  vm.runInNewContext(`(${source.slice(click.start, click.end)})`, {
    lookModeRef, setIsLookMode: value => state.look = value,
    setIsRailOverheadView: value => state.rail = value,
    setIsTopDownView: value => state.top = value,
    topViewControlsRef: { current: { exit: () => state.top = false } },
    cameraUpdateRef: { current: () => state.updates++ }
  })();
  assert.equal(lookModeRef.current, false);
  assert.deepEqual(state, { look: false, rail: false, top: false, updates: 1 });
});
