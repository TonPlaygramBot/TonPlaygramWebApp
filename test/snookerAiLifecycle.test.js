import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { buildSnookerViewerHud } from '../webapp/src/pages/Games/snookerRoyalMatchQuality.js';

// Execute the actual AI scheduler from the game, with deterministic timers.
// Rendering is stubbed; ownership, cancellation, power handoff and foul rules run.
const source = fs.readFileSync(
  'webapp/src/pages/Games/SnookerRoyal.jsx',
  'utf8'
);
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
let scheduler;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (
    node.type === 'AssignmentExpression' &&
    node.left?.object?.name === 'aiShoot' &&
    node.left?.property?.name === 'current'
  )
    scheduler = source.slice(node.right.start, node.right.end);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value?.type) walk(value);
  }
}
walk(ast);

function rig() {
  const timers = new Map();
  let nextId = 0;
  const fire = jest.fn();
  const rules = new SnookerRoyalRules();
  const frame = { ...rules.getInitialFrame('Human', 'Bot'), activePlayer: 'B' };
  const cue = { id: 'cue', active: true, pos: new THREE.Vector2() };
  const context = {
    THREE,
    console,
    aiOpponentEnabled: true,
    disposed: false,
    hudRef: { current: { turn: 1, over: false, inHand: false, power: 0 } },
    frameRef: { current: frame },
    frameState: frame,
    localSeatRef: { current: 'A' },
    rules,
    replayPlaybackRef: { current: false },
    aiRetryTimeoutRef: { current: null },
    aiShotTimeoutRef: { current: null },
    aiShotCueDropTimeoutRef: { current: null },
    aiCueViewBlendRef: { current: 0 },
    aiPlanRef: { current: null },
    aimDirRef: { current: new THREE.Vector2(0, 1) },
    topViewRef: { current: false },
    topViewLockedRef: { current: false },
    cuePullCurrentRef: { current: 0 },
    cuePullTargetRef: { current: 0 },
    powerRef: { current: 0 },
    spinRef: { current: {} },
    spinRequestRef: { current: {} },
    resetSpinRef: { current: jest.fn() },
    balls: [cue],
    ballsRef: { current: [cue] },
    cue,
    shooting: false,
    allStopped: () => true,
    autoPlaceAiCueBall: jest.fn(),
    cancelAiShotPreview: jest.fn(),
    clearEarlyAiShot: jest.fn(),
    stopAiThinking: jest.fn(),
    setAiPlanning: jest.fn(),
    setIsTopDownView: jest.fn(),
    alignStandingCameraToAim: jest.fn(),
    setAiShotCueViewActive: jest.fn(),
    setAiShotPreviewActive: jest.fn(),
    cancelCameraBlendTween: jest.fn(),
    applyCameraBlend: jest.fn(),
    updateCamera: jest.fn(),
    setHud: jest.fn(),
    tweenCameraBlend: jest.fn(),
    setFrameState: jest.fn(),
    setInHandPlacementMode: jest.fn(),
    showRuleToast: jest.fn(),
    buildSnookerViewerHud,
    evaluateShotOptions: () => ({
      bestPot: {
        type: 'pot',
        aimDir: new THREE.Vector2(0, -1),
        power: 0.63,
        spin: { x: 0, y: 0 }
      }
    }),
    computePowerFromDistance: () => 0.5,
    BALL_R: 1,
    AI_CAMERA_DROP_BLEND: 0.5,
    AI_CAMERA_DROP_LEAD_MS: 100,
    AI_CAMERA_SETTLE_MS: 100,
    AI_CUE_VIEW_HOLD_MS: 100,
    AI_CAMERA_DROP_DURATION_MS: 100,
    resolveAiPreviewDelay: () => 300,
    fire,
    aiShoot: { current: null },
    clearTimeout: (id) => timers.delete(id),
    window: {
      setTimeout: (fn) => {
        const id = ++nextId;
        timers.set(id, fn);
        return id;
      }
    }
  };
  vm.createContext(context);
  context.aiShoot.current = vm.runInContext(`(${scheduler})`, context);
  const flush = () => {
    let count = 0;
    while (timers.size && count++ < 10) {
      const [id, fn] = timers.entries().next().value;
      timers.delete(id);
      fn();
    }
    if (timers.size) throw new Error('AI retry loop');
  };
  return { context, timers, fire, flush };
}

test('AI fires once with captured plan power even if the UI power resets', () => {
  const r = rig();
  r.context.aiShoot.current();
  r.context.powerRef.current = 0;
  r.flush();
  expect(r.fire.mock.calls).toEqual([[0.63, 'B']]);
});
test.each(['turn', 'disposed', 'over', 'frame', 'replay', 'inHand'])(
  'queued AI shot cancels when %s changes',
  (change) => {
    const r = rig();
    r.context.aiShoot.current();
    if (change === 'turn') r.context.hudRef.current.turn = 0;
    if (change === 'disposed') r.context.disposed = true;
    if (change === 'over') r.context.hudRef.current.over = true;
    if (change === 'frame')
      r.context.frameRef.current = { ...r.context.frameRef.current };
    if (change === 'replay') r.context.replayPlaybackRef.current = true;
    if (change === 'inHand') r.context.hudRef.current.inHand = true;
    r.flush();
    expect(r.fire).not.toHaveBeenCalled();
  }
);
test('AI scheduler cannot start during the human turn', () => {
  const r = rig();
  r.context.hudRef.current.turn = 0;
  r.context.aiShoot.current();
  expect(r.timers.size).toBe(0);
  expect(r.context.setHud).not.toHaveBeenCalled();
});
test('a delayed still-moving retry cancels after the turn changes', () => {
  const r = rig();
  r.context.allStopped = () => false;
  r.context.aiShoot.current();
  r.context.hudRef.current.turn = 0;
  r.flush();
  expect(r.fire).not.toHaveBeenCalled();
});
test('planner failure awards a real foul instead of silently granting ball-in-hand', () => {
  const r = rig();
  r.context.console = { error: jest.fn() };
  r.context.evaluateShotOptions = () => {
    throw new Error('planner failure');
  };
  r.context.aiShoot.current();
  expect(r.context.frameRef.current.activePlayer).toBe('A');
  expect(r.context.frameRef.current.players.A.score).toBe(4);
  expect(r.context.hudRef.current.turn).toBe(0);
  expect(r.context.hudRef.current.inHand).toBe(false);
  expect(r.fire).not.toHaveBeenCalled();
});
