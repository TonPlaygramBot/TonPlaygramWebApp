import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import { PowerSlider } from '../power-slider.js';
import { deliverOrQueueSnookerShot } from '../webapp/src/pages/Games/snookerShotRelease.js';
import { resolvePoolRoyalReleasePower } from '../webapp/src/pages/Games/poolRoyaleShotState.js';
import {
  sampleCueStrokeTimeline,
  resolveCueBallContact
} from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';

// Execute the production release callback itself. Scene presentation is stubbed;
// Three.js vectors, the slider release, stroke timing and ball impulse are real.
const source = fs.readFileSync(
  'webapp/src/pages/Games/SnookerRoyal.jsx',
  'utf8'
);
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let fireCode, obstructionCode;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id.name === 'fire')
    fireCode = source.slice(node.init.start, node.init.end);
  if (
    node.type === 'FunctionDeclaration' &&
    node.id?.name === 'resolveCueObstruction'
  )
    obstructionCode = source.slice(node.start, node.end);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value?.type) walk(value);
  }
}
walk(ast);
function rig() {
  const raf = [],
    timers = new Map();
  let timerId = 0,
    now = 0;
  const cue = {
    id: 'cue',
    active: true,
    pos: new THREE.Vector2(),
    vel: new THREE.Vector2(),
    spin: new THREE.Vector2(),
    pendingSpin: new THREE.Vector2()
  };
  const context = {
    THREE,
    Math,
    Number,
    Boolean,
    Array,
    Set,
    performance: { now: () => now },
    cue,
    balls: [cue],
    cueStick: new THREE.Object3D(),
    resolvePoolRoyalReleasePower,
    sampleCueStrokeTimeline,
    resolveCueBallContact,
    requestAnimationFrame: (fn) => {
      raf.push(fn);
      return raf.length;
    },
    clearInterval: () => {},
    clearTimeout: (id) => timers.delete(id),
    window: {
      setTimeout: (fn) => {
        timers.set(++timerId, fn);
        return timerId;
      }
    },
    disposed: false,
    shooting: false,
    cueAnimating: false,
    shotImpactPending: false,
    shotImpactFallbackTimer: null,
    camera: null,
    aiOpponentEnabled: true,
    activeBroadcastSystem: null,
    activeShotView: null,
    queuedPocketView: null,
    suspendedActionView: null,
    cueLen: 1,
    cueTipLocal: new THREE.Vector3(0, 0, -0.5),
    cueButtLocal: new THREE.Vector3(0, 0, 0.5),
    frameState: {
      activePlayer: 'A',
      currentBreak: 0,
      meta: { variant: 'snooker', state: { ballInHand: false } }
    },
    allowFullTableInHand: () => false,
    allStopped: (balls) =>
      balls.every((b) => !b.active || b.vel.lengthSq() < 0.0001),
    calcTarget: () => ({ tHit: 10, targetBall: null }),
    computePullTargetFromPower: (p) => p * 0.25,
    applyVisualPullCompensation: (v) => v,
    applySpinConstraints: () => ({ x: 0, y: 0 }),
    mapSpinForPhysics: (s) => s,
    resolveUserCueLift: () => 0,
    normalizeCueLift: () => 0,
    computeSpinOffsets: () => ({ side: 0, vert: 0, hasSpin: false }),
    resolveCueObstructionTilt: () => ({
      obstructionTilt: 0,
      obstructionLift: 0,
      obstructionTiltFromLift: 0
    }),
    resolveCueTipTarget: (dir, pull) =>
      dir.clone().multiplyScalar(-pull - 0.03),
    resolveCueFollowGuideDir2D: () => new THREE.Vector2(0, 1),
    serializeVector3Snapshot: (v) => ({ x: v.x, y: v.y, z: v.z }),
    captureBallSnapshot: () => [],
    makeActionCameraView: () => null,
    makePocketCameraView: () => null,
    easeInOutQuad: (t) => t,
    easeOutCubic: (t) => 1 - (1 - t) ** 3,
    clampOrbitRadius: (v) => v,
    playCueHit: jest.fn(),
    careerMatch: null,
    isOnlineMatch: false,
    skipAllReplaysRef: { current: false }
  };
  for (const key of [
    'CAMERA_SWITCH_MIN_HOLD_MS',
    'AI_CAMERA_DROP_BLEND',
    'AI_POST_SHOT_CAMERA_HOLD_MS',
    'MAX_POWER_CAMERA_HOLD_MS',
    'CUE_IMPACT_CAMERA_HOLD_MS'
  ])
    context[key] = 100;
  for (const key of [
    'CUE_Y',
    'BALL_CENTER_Y',
    'MAX_BACKSPIN_TILT',
    'CUE_PULL_VISUAL_FUDGE',
    'CUE_PULL_MIN_VISUAL',
    'CUE_TIP_GAP'
  ])
    context[key] = 0.01;
  Object.assign(context, {
    BALL_R: 0.03,
    CUE_TIP_RADIUS: 0.005,
    CUE_PULL_BASE: 0.25,
    ENABLE_CUE_STROKE_ANIMATION: true,
    SHORT_SHOT_CAMERA_DISTANCE: 1,
    LONG_SHOT_DISTANCE: 20,
    LONG_SHOT_SPEED_SWITCH_THRESHOLD: 50,
    MAX_POWER_BOUNCE_THRESHOLD: 0.95,
    POWER_REPLAY_THRESHOLD: 0.8,
    SPIN_REPLAY_THRESHOLD: 0.5,
    SHOT_MIN_FACTOR: 0.1,
    SHOT_POWER_RANGE: 0.9,
    SHOT_BASE_SPEED: 100,
    SHOT_BREAK_MULTIPLIER: 1.2,
    SIDE_SPIN_MULTIPLIER: 1,
    BACKSPIN_MULTIPLIER: 1,
    TOPSPIN_MULTIPLIER: 1,
    JUMP_SHOT_POWER_THRESHOLD: 0.9,
    JUMP_SHOT_LIFT_THRESHOLD: 0.5,
    CUE_OBSTRUCTION_CLEARANCE: 0.1,
    CUE_OBSTRUCTION_RAIL_CLEARANCE: 0.1,
    CUE_OBSTRUCTION_RAIL_INFLUENCE: 1,
    RAIL_LIMIT_X: 5,
    RAIL_LIMIT_Y: 10,
    CAMERA: { minPhi: 0, maxPhi: Math.PI },
    BREAK_VIEW: { radius: 5 }
  });
  for (const key of [
    'shootingRef',
    'cueBallPlacedFromHandRef',
    'aiShotCueViewRef',
    'aimFocusRef',
    'replayPlaybackRef',
    'cameraRef',
    'sphRef',
    'activeRenderCameraRef',
    'cameraBoundsRef',
    'lastCameraTargetRef',
    'broadcastSystemRef',
    'pocketSwitchIntentRef',
    'lastPocketBallRef',
    'cueImpactCameraRef',
    'shotReplayRef',
    'topViewRef',
    'topViewLockedRef',
    'tipGroupRef'
  ])
    context[key] = { current: null };
  for (const key of [
    'aiTurnShotCountRef',
    'powerImpactHoldRef',
    'cuePullCurrentRef',
    'cuePullTargetRef',
    'timerRef',
    'aiCueViewBlendRef'
  ])
    context[key] = { current: 0 };
  Object.assign(context, {
    hudRef: { current: { turn: 0, inHand: false, over: false } },
    frameRef: { current: context.frameState },
    ballsRef: { current: [cue] },
    powerRef: { current: 0 },
    aimDirRef: { current: new THREE.Vector2(0, 1) },
    spinRef: { current: { x: 0, y: 0 } },
    spinRangeRef: { current: {} },
    cueLiftRef: { current: {} },
    cueStickAnchorRef: { current: new THREE.Vector3() },
    shotContextRef: { current: {} },
    resetSpinRef: { current: () => {} }
  });
  for (const key of [
    'alignStandingCameraToAim',
    'setAiShotCueViewActive',
    'setAiShotPreviewActive',
    'cancelCameraBlendTween',
    'applyCameraBlend',
    'updateCamera',
    'setHud',
    'recordReplayFrame',
    'applyCueButtTilt',
    'clampCueTipOffset',
    'applyCueObstructionLift',
    'setIsTopDownView',
    'syncBlendToSpherical',
    'updatePocketCameraState'
  ])
    context[key] = () => {};
  for (const key of [
    'TMP_VEC3_CUE_TIP_OFFSET',
    'TMP_VEC3_CUE_BUTT_OFFSET',
    'TMP_VEC3_BUTT'
  ])
    context[key] = new THREE.Vector3();
  context.setShootingState = (value) => {
    context.shooting = value;
    context.shootingRef.current = value;
  };
  vm.createContext(context);
  vm.runInContext(`${obstructionCode}\nthis.fire=${fireCode}`, context);
  const slider = Object.create(PowerSlider.prototype);
  Object.assign(slider, {
    value: 65,
    dragging: true,
    activePointerId: 7,
    _feedbackBand: 2,
    el: {
      releasePointerCapture: () => {},
      removeEventListener: () => {},
      classList: { remove: () => {} }
    },
    _playShotAnimation: () => {},
    animateToMin: () => {},
    onCommit: (p) =>
      deliverOrQueueSnookerShot({
        fire: context.fire,
        power: p / 100,
        pendingRef: { current: null }
      })
  });
  return {
    context,
    cue,
    slider,
    timers,
    advance(t) {
      now = t;
      raf.splice(0).forEach((fn) => fn(t));
    }
  };
}

test.each([10, 50, 100])(
  'production slider release at %i%% launches the ball once',
  (power) => {
    const r = rig();
    r.slider.value = power;
    r.slider._pointerUp({ type: 'pointerup', pointerId: 7 });
    expect(r.context.shootingRef.current).toBe(true);
    expect(r.cue.vel.length()).toBe(0);
    // Resetting the UI before contact must not erase the committed impulse.
    r.context.powerRef.current = 0;
    r.advance(120);
    r.advance(220);
    expect(r.cue.vel.y).toBeCloseTo(100 * (0.1 + (0.9 * power) / 100));
    expect(r.cue.vel.x).toBeCloseTo(0);
    expect(r.context.playCueHit).toHaveBeenCalledTimes(1);
    r.advance(300);
    r.advance(400);
    expect(r.context.cueAnimating).toBe(false);
    expect(r.context.playCueHit).toHaveBeenCalledTimes(1);
  }
);
test('fallback launches exactly once when the stroke frame is dropped', () => {
  const r = rig();
  r.context.fire(0.7);
  for (const fn of r.timers.values()) fn();
  expect(r.cue.vel.length()).toBeGreaterThan(0);
  r.advance(500);
  expect(r.context.playCueHit).toHaveBeenCalledTimes(1);
});
test('cancel, unrelated finger, busy state and opponent ownership never fire', () => {
  for (const event of [
    { type: 'pointercancel', pointerId: 7 },
    { type: 'lostpointercapture', pointerId: 7 },
    { type: 'pointerup', pointerId: 8 }
  ]) {
    const r = rig();
    r.slider._pointerUp(event);
    r.advance(500);
    expect(r.cue.vel.length()).toBe(0);
  }
  const r = rig();
  r.context.hudRef.current.turn = 1;
  expect(r.context.fire(0.7)).toBe(false);
  r.context.hudRef.current.turn = 0;
  r.context.shootingRef.current = true;
  expect(r.context.fire(0.7)).toBe(false);
});
test('a disposed scene cannot receive a late cue impact', () => {
  const r = rig();
  r.context.fire(0.7);
  r.context.disposed = true;
  r.advance(220);
  for (const fn of r.timers.values()) fn();
  expect(r.cue.vel.length()).toBe(0);
});
