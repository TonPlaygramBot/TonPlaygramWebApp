import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { resolvePoolRoyalAddressState } from '../webapp/src/pages/Games/shared/poolRoyalAddress.ts';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
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
    const state = { look: true, rail: true, top: true, updates: 0, replayStops: 0 };
    const lookModeRef = ref(true);
    const playerEyeViewEnabledRef = ref(false);
    evaluate(click, { isPortrait, lookModeRef, playerEyeViewEnabledRef, setIsLookMode: v => state.look = v,
      setIsRailOverheadView: v => state.rail = v, setIsTopDownView: v => state.top = v,
      topViewControlsRef: ref({ exit: () => state.top = false }),
      skipReplayRef: ref(() => state.replayStops++),
      cameraUpdateRef: ref(() => state.updates++) })();
    assert.equal(lookModeRef.current, false);
    assert.equal(playerEyeViewEnabledRef.current, true);
    assert.deepEqual(state, { look: false, rail: false, top: false, updates: 1, replayStops: 1 });
  }
});

test('the final JSX camera follows only the local eyes through both players turns, strokes and recovery', async () => {
  const m = await readPoolRoyalMetrics();
  const world = new THREE.Group(); world.position.set(11, -4, 5); world.scale.setScalar(.23); world.rotation.y = .7;
  const players = new PoolRoyalHumanPlayers(world, { ...m, model: await loadPoseModel(), realisticMovement: true });
  assert.ok(await players.ready);
  assert.equal(players.getEyeView('A'), null, 'wait for the first animated pose');
  const localSeatRef = ref('A'), playerEyeViewEnabledRef = ref(true);
  const replayPlaybackRef = ref(null), cueGalleryStateRef = ref(null);
  const camera = new THREE.PerspectiveCamera(66, 390 / 844, .04, 4000);
  const context = { THREE, camera, STANDING_VIEW_FOV: 66, CAMERA: { near: .04, far: 4000 },
    activeHumanPlayersRef: ref(players), localSeatRef, playerEyeViewEnabledRef,
    replayPlaybackRef, cueGalleryStateRef, world, replayPlaybackActive: false };
  const resolveEye = evaluate(variable('resolveLocalHumanEyePose').init, context);
  const start = source.indexOf('const humanEyePose = resolveLocalHumanEyePose();');
  const end = source.indexOf('if (lookTarget) {', start);
  assert.ok(start > 0 && end > start);
  const applyFinalCamera = vm.runInNewContext(`(renderCamera, lookTarget) => {
    ${source.slice(start, end)}
    return { renderCamera, lookTarget };
  }`, { ...context, humanEyeCamera: evaluate(variable('humanEyeCamera').init, context), resolveLocalHumanEyePose: resolveEye });
  let movingFrames = 0;
  for (const localSeat of ['A', 'B']) for (const activeSeat of ['A', 'B']) for (let frame = 0; frame < 210; frame++) {
    localSeatRef.current = localSeat;
    const state = frame < 140 ? 'dragging' : frame < 150 ? 'striking' : 'idle';
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, frame > 90 ? .3 : 0);
    const cueBall = new THREE.Vector3(0, m.ballY, m.tableL * .31 - (state === 'idle' ? frame - 150 : 0));
    players.update(1 / 60, { activeSeat, state, power: .7, nowMs: frame * 16, cueBall, aimForward: forward });
    assert.ok(players.getEyeView(localSeat), 'standing, shooting and opponent turns retain the local eyes');
    const human = players.players.find(p => p.seat === localSeat).human;
    const middle = human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
      .lerp(human.model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), .5);
    const sourceCamera = new THREE.PerspectiveCamera(72, 390 / 844, .04, 4000);
    sourceCamera.position.set(50, 90, -60); sourceCamera.up.set(0, 0, 1); sourceCamera.zoom = 3;
    sourceCamera.setViewOffset(390, 844, 80, 180, 120, 200);
    const final = applyFinalCamera(sourceCamera, new THREE.Vector3());
    assert.ok(final.renderCamera.position.distanceTo(middle) < 1e-8);
    const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(human.bones.head.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(final.renderCamera.getWorldDirection(new THREE.Vector3()).dot(headForward) > .99999,
      'the camera faces out of the head, not towards a moving cue ball');
    assert.equal(final.renderCamera.fov, 66);
    assert.equal(final.renderCamera.zoom, 1);
    assert.equal(final.renderCamera.view, null, 'no inherited broadcast crop');
    assert.equal(final.renderCamera.aspect, 390 / 844);
    assert.deepEqual(sourceCamera.position.toArray(), [50, 90, -60], 'broadcast source is untouched');
    final.renderCamera.updateMatrixWorld(true);
    const target = final.lookTarget.clone().project(final.renderCamera);
    assert.ok(Math.abs(target.x) < 1e-7 && Math.abs(target.y) < 1e-7);
    if (players.walking || human.poseT < .95) movingFrames++;
  }
  assert.ok(movingFrames > 30, 'exercise the transition that used to lose the eyes');
  assert.equal(players.getEyeView('invalid'), null, 'never fall back to the active opponent');
  for (const player of players.players) {
    const mesh = player.firstPerson.meshes[0];
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const shader = { uniforms: {}, fragmentShader: '#include <clipping_planes_fragment>' };
    material.onBeforeCompile(shader, {});
    const final = applyFinalCamera(camera, new THREE.Vector3());
    mesh.onBeforeRender({}, world, final.renderCamera, mesh.geometry, material, null);
    assert.equal(shader.uniforms.poolLocalFace.value, player.seat === localSeatRef.current ? 1 : 0);
    assert.equal(mesh.visible, true, 'heads remain visible to other cameras');
  }
  playerEyeViewEnabledRef.current = false;
  assert.equal(resolveEye(), null, 'explicit overhead selection still works');
  playerEyeViewEnabledRef.current = true; cueGalleryStateRef.current = { active: true };
  assert.equal(resolveEye(), null, 'explicit equipment inspection still works');
  cueGalleryStateRef.current = null; replayPlaybackRef.current = {};
  assert.equal(resolveEye(), null, 'a replay already in progress owns its recorded view');
  players.dispose();
  assert.equal(players.getEyeView('A'), null);
});

test('automatic shot overhead and replay callbacks cannot take the local eye camera', () => {
  const playerEyeViewEnabledRef = ref(true), topViewRef = ref(false);
  let timeout, overheads = 0;
  const setShooting = evaluate(variable('setShootingState').init, {
    shooting: false, shotStartedAt: 0, getNow: () => 100, maxPowerLiftTriggered: false,
    shotCameraHoldTimeoutRef: ref(null), clearTimeout() {},
    preShotTopViewRef: ref(false), preShotTopViewLockRef: ref(false), topViewRef, topViewLockedRef: ref(false),
    playerEyeViewEnabledRef, window: { setTimeout: fn => { timeout = fn; return 1; } },
    SHOT_CAMERA_HOLD_MS: 2600, enterTopView: () => overheads++, exitTopView() {}, setShotActive() {}
  });
  setShooting(true); timeout();
  assert.equal(topViewRef.current, false); assert.equal(overheads, 0);
  evaluate(variable('enterTopView').init, { playerEyeViewEnabledRef, topViewRef })();
  assert.equal(topViewRef.current, false, 'pocket/AI helpers cannot force overhead either');
  const replayContext = { playerEyeViewEnabledRef, shotReplayRef: ref({}), shotRecording: {},
    slate: true, setReplaySlate() { this.slate = false; } };
  replayContext.setReplaySlate = () => { replayContext.slate = false; };
  evaluate(variable('startShotReplay').init, replayContext)({});
  assert.equal(replayContext.shotReplayRef.current, null);
  assert.equal(replayContext.shotRecording, null);
  assert.equal(replayContext.slate, false);
  const recording = {};
  const delayedContext = { playerEyeViewEnabledRef, replayBannerTimeoutRef: ref(1), setReplayBanner() {},
    recordingForReplay: recording, shotRecording: recording, shotReplayRef: ref(recording),
    triggerReplaySlate() { throw new Error('a delayed replay must not interrupt player view'); } };
  evaluate(variable('launchReplay').init, delayedContext)();
  assert.equal(delayedContext.shotRecording, null);
  assert.equal(delayedContext.shotReplayRef.current, null);
  const replayConditions = nodes.filter(node => node.type === 'AssignmentExpression' && node.left.name === 'shouldStartReplay').map(n => n.right);
  replayConditions.push(variable('shouldStartReplay').init);
  for (const condition of replayConditions) {
    assert.equal(evaluate(condition, { ENABLE_SHOT_REPLAY: true, autoReplayEnabledRef: ref(true), playerEyeViewEnabledRef }), false);
  }
  playerEyeViewEnabledRef.current = false; setShooting(false); setShooting(true); timeout();
  assert.equal(overheads, 1, 'other manually selected views retain their existing cameras');
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
