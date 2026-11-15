import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';

// Execute the production functions from both games with the same measured
// table. Comparing live outputs catches drift without mounting either game or
// substituting a second implementation of its broadcast director.
async function readGame(file) {
  const source = await readFile(new URL(`../webapp/src/pages/Games/${file}`, import.meta.url), 'utf8');
  const declarations = new Map();
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      declarations.set(node.id.name, node.init);
    }
    if (node.type === 'FunctionDeclaration') declarations.set(node.id.name, node);
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(visit);
      else if (child?.type) visit(child);
    }
  };
  visit(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  return {
    file,
    evaluate(name, context) {
      if (Object.hasOwn(context, name)) return context[name];
      const node = declarations.get(name);
      assert.ok(node, `${file} must define ${name}`);
      const expression = `(${source.slice(node.start, node.end)})`;
      for (;;) {
        try {
          context[name] = vm.runInContext(expression, context);
          return context[name];
        } catch (error) {
          const dependency = /^([A-Za-z_$][\w$]*) is not defined$/.exec(error.message)?.[1];
          if (!dependency || !declarations.has(dependency)) throw error;
          this.evaluate(dependency, context);
        }
      }
    }
  };
}

const games = await Promise.all(['PoolRoyale.jsx', 'SnookerRoyal.jsx'].map(readGame));
const plain = value => JSON.parse(JSON.stringify(value));
const fixture = overrides => vm.createContext({
  THREE,
  BALL_R: 1,
  BALL_DIAMETER: 2,
  PLAY_W: 80,
  PLAY_H: 160,
  TABLE: { W: 92, H: 174, THICK: 3 },
  TABLE_Y: 24,
  SIDE_RAIL_INNER_THICKNESS: 4,
  END_RAIL_INNER_THICKNESS: 5,
  POCKET_VIS_R: 2.5,
  CAPTURE_R: 2,
  performance: { now: () => 1000 },
  ...overrides
});

test('Snooker uses the same fixed broadcast preset and rail/pocket framing values as Pool', () => {
  const names = [
    'BROADCAST_SYSTEM_OPTIONS', 'DEFAULT_BROADCAST_SYSTEM_ID', 'LOCK_RAIL_OVERHEAD_FRAME',
    'RAIL_OVERHEAD_SCREEN_OFFSET', 'RAIL_OVERHEAD_TOP_VIEW_MIN_RADIUS_SCALE',
    'RAIL_OVERHEAD_TOP_VIEW_RADIUS_SCALE', 'RAIL_OVERHEAD_PHI',
    'RAIL_OVERHEAD_DISTANCE_BIAS', 'RAIL_OVERHEAD_REPLAY_FOV', 'SHOT_CAMERA_HOLD_MS', 'ACTION_CAM', 'POCKET_CAM',
    'POCKET_CAM_EARLY_TRIGGER_DIST', 'POCKET_CAM_CORNER_OUTSIDE_MULTIPLIER',
    'POCKET_CAM_SIDE_OUTSIDE_MULTIPLIER', 'POCKET_VIEW_MIN_DURATION_MS',
    'POCKET_VIEW_ACTIVE_EXTENSION_MS', 'POCKET_VIEW_POST_POT_HOLD_MS', 'POCKET_VIEW_MAX_HOLD_MS',
    'POCKET_GUARANTEED_ALIGNMENT'
  ];
  const values = games.map(game => {
    const context = fixture();
    return Object.fromEntries(names.map(name => [name, plain(game.evaluate(name, context))]));
  });
  assert.deepEqual(values[1], values[0]);
  const [preset] = values[1].BROADCAST_SYSTEM_OPTIONS;
  assert.equal(preset.trackingBias, 0, 'moving balls must not drag the rail frame');
  assert.equal(preset.orbitBias, 0, 'player orbit must not drag the rail frame');
  assert.equal(preset.smoothing, 1);
  assert.equal(values[1].SHOT_CAMERA_HOLD_MS, 2600);
});

function rigSnapshot(rig) {
  rig.group.updateMatrixWorld(true);
  return {
    focus: rig.defaultFocus.toArray(),
    activeRail: rig.activeRail,
    trackedFocus: rig.userData?.focus?.toArray(),
    units: ['front', 'back'].map(id => {
      const unit = rig.cameras[id];
      return {
        rail: unit.rail,
        direction: unit.direction,
        position: unit.base.getWorldPosition(new THREE.Vector3()).toArray(),
        head: unit.head.getWorldPosition(new THREE.Vector3()).toArray(),
        orientation: unit.head.getWorldQuaternion(new THREE.Quaternion()).toArray(),
        slider: unit.slider.position.toArray(),
        sliderScale: unit.slider.scale.toArray(),
        visible: unit.base.visible
      };
    })
  };
}

function broadcastFixture(game) {
  const context = fixture();
  const create = game.evaluate('createBroadcastCameras', context);
  const rig = create({ floorY: -8, cameraHeight: 170, shortRailZ: 100, slideLimit: 0, arenaHalfDepth: 130 });
  const world = new THREE.Group();
  world.position.set(3, -7, 4);
  world.scale.setScalar(.65);
  world.add(rig.group);
  world.updateMatrixWorld(true);
  context.broadcastCamerasRef = { current: rig };
  context.BROADCAST_SYSTEM_OPTIONS = game.evaluate('BROADCAST_SYSTEM_OPTIONS', context);
  context.broadcastSystemRef = { current: context.BROADCAST_SYSTEM_OPTIONS[0] };
  context.activeBroadcastSystem = context.BROADCAST_SYSTEM_OPTIONS[0];
  for (const name of ['LOCK_RAIL_OVERHEAD_FRAME', 'DEFAULT_BROADCAST_SYSTEM_ID', 'BROADCAST_ORBIT_FOCUS_BIAS', 'sanitizeVector3']) {
    game.evaluate(name, context);
  }
  // sanitizeVector3 resolves this helper when called rather than when defined.
  game.evaluate('isFiniteVector3', context);
  return { rig, update: game.evaluate('updateBroadcastCameras', context) };
}

test('broadcast camera mounts have identical world positions and orientations at the same table scale', () => {
  const rigs = games.map(broadcastFixture);
  assert.deepEqual(rigSnapshot(rigs[1].rig), rigSnapshot(rigs[0].rig));
});

test('broadcast updates keep the full-table focus fixed and honor the selected rail', () => {
  const rigs = games.map(broadcastFixture);
  for (const preferredRail of ['front', 'back', null]) {
    for (const railDir of [-1, 1]) {
      for (const sign of [-1, 1]) {
        const focus = new THREE.Vector3(0, 24, 0);
        const update = {
          preferredRail, railDir, focusWorld: focus,
          targetWorld: new THREE.Vector3(sign * 70, 5, sign * 130),
          orbitWorld: new THREE.Vector3(sign * 140, 80, -sign * 200)
        };
        rigs.forEach(({ update: apply }) => apply(update));
        assert.deepEqual(rigSnapshot(rigs[1].rig), rigSnapshot(rigs[0].rig));
        assert.deepEqual(rigs[1].rig.userData.focus, focus, 'shot motion cannot change the selected full-table focus');
        if (preferredRail) assert.equal(rigs[1].rig.activeRail, preferredRail);
        assert.deepEqual(focus.toArray(), [0, 24, 0], 'caller focus is not mutated');
      }
    }
  }
});

function shotFixture(game, manualTop = false) {
  let nextTimer = 0;
  const pending = new Map();
  const calls = [];
  const context = fixture({
    shooting: false, shootingRef: { current: false }, shotStartedAt: 0, disposed: false,
    getNow: () => 100, shotImpactPending: true, shotImpactFallbackTimer: null,
    maxPowerLiftTriggered: false, cueImpactCameraRef: { current: null },
    preShotTopViewRef: { current: false }, preShotTopViewLockRef: { current: false },
    topViewRef: { current: manualTop }, topViewLockedRef: { current: manualTop },
    shotCameraHoldTimeoutRef: { current: null },
    window: { setTimeout(callback, delay) { const id = ++nextTimer; pending.set(id, { callback, delay }); return id; } },
    clearTimeout(id) { pending.delete(id); },
    enterTopView(force, options) { calls.push(['enter', force, plain(options)]); context.topViewRef.current = true; },
    exitTopView(force) { calls.push(['exit', force]); context.topViewRef.current = false; },
    setShotActive(value) { calls.push(['active', value]); }
  });
  game.evaluate('SHOT_CAMERA_HOLD_MS', context);
  return { context, pending, calls, set: game.evaluate('setShootingState', context) };
}

test('both shot lifecycles hand off at 2600 ms and preserve the pre-shot manual view', () => {
  for (const manualTop of [false, true]) {
    for (const game of games) {
      const { context, pending, calls, set } = shotFixture(game, manualTop);
      set(true);
      assert.equal(context.shooting, true);
      assert.equal(pending.size, 1, game.file);
      const [{ callback, delay }] = pending.values();
      assert.equal(delay, 2600);
      set(true);
      assert.equal(pending.size, 1, 'repeat state must not restart the clock');
      pending.clear(); // browser removes a fired timer before calling it
      callback();
      assert.equal(context.shotCameraHoldTimeoutRef.current, null);
      assert.equal(context.topViewRef.current, true);
      assert.equal(context.topViewLockedRef.current, true);
      assert.deepEqual(calls.find(call => call[0] === 'enter'), ['enter', true, { variant: 'rail' }]);
      set(false);
      assert.equal(context.topViewRef.current, manualTop, 'return to the view chosen before the shot');
      if (manualTop) assert.equal(context.topViewLockedRef.current, true);
      assert.equal(pending.size, 0);
    }
  }
});

test('ending a shot cancels its pending broadcast timer and a stale callback cannot change the view', () => {
  for (const game of games) {
    const { context, pending, calls, set } = shotFixture(game);
    set(true);
    const [{ callback }] = pending.values();
    set(false);
    assert.equal(pending.size, 0, game.file);
    assert.equal(context.shotCameraHoldTimeoutRef.current, null);
    callback();
    assert.equal(context.topViewRef.current, false);
    assert.equal(calls.filter(call => call[0] === 'enter').length, 0);
    set(true);
    assert.equal(pending.size, 1, 'the next shot gets its own timer');
  }
});

test('Snooker cannot switch the camera after its scene is disposed', () => {
  const { context, pending, calls, set } = shotFixture(games[1]);
  set(true);
  const [{ callback }] = pending.values();
  context.disposed = true;
  callback();
  assert.equal(context.shotCameraHoldTimeoutRef.current, null);
  assert.equal(calls.filter(call => call[0] === 'enter').length, 0);
});

test('action-camera setup matches Pool for short, long and cushion-first shots', () => {
  for (const railNormal of [null, new THREE.Vector2(-1, 0)]) {
    for (const longShot of [false, true]) {
      const views = games.map(game => {
        const cue = { id: 'cue', pos: new THREE.Vector2(5, 60), vel: new THREE.Vector2(0, -1) };
        const target = { id: 'red-1', pos: new THREE.Vector2(-10, -30) };
        const context = fixture({
          RAIL_LIMIT_X: 39, RAIL_LIMIT_Y: 79,
          ballsRef: { current: [cue, target] },
          signed: (value, fallback = 1) => Math.sign(value) || fallback
        });
        for (const name of ['RAIL_NEAR_BUFFER', 'LONG_SHOT_ACTIVATION_DELAY_MS',
          'LONG_SHOT_ACTIVATION_TRAVEL', 'resolveOppositeShortRailCamera']) game.evaluate(name, context);
        const make = game.evaluate('makeActionCameraView', context);
        return plain(make(cue, target.id, { orbitSnapshot: { radius: 110, phi: .5, theta: 0 } },
          railNormal, { longShot, travelDistance: 90 }));
      });
      assert.deepEqual(views[1], views[0]);
      assert.equal(views[1].stage, 'followCue');
      assert.equal(views[1].preferRailOverhead, Boolean(railNormal));
    }
  }
});

test('a maximum-power cushion-first shot retains priority rail coverage', () => {
  const context = fixture({
    isCushionTargetShot: true, isLongShot: true,
    forceActionActivation: false, isMaxPowerShot: true,
    isBreakCameraShot: true, isShortStraightShot: false
  });
  assert.equal(games[1].evaluate('allowLongShotCameraSwitch', context), true,
    'cushion coverage is available even on the opening break');
  assert.equal(games[1].evaluate('shouldActivateActionView', context), true,
    'maximum power cannot postpone the cushion-first rail cut');
});

function pocketFixture(game, { pocket = 'TR', bank = false, alignment = true } = {}) {
  const pockets = new Map([
    ['TL', new THREE.Vector2(-40, -80)], ['TR', new THREE.Vector2(40, -80)],
    ['BL', new THREE.Vector2(-40, 80)], ['BR', new THREE.Vector2(40, 80)],
    ['TM', new THREE.Vector2(-40, 0)], ['BM', new THREE.Vector2(40, 0)]
  ]);
  const center = pockets.get(pocket);
  const direction = center.clone().normalize();
  const ball = { id: 'red-1', active: true, pos: center.clone().addScaledVector(direction, -25), vel: direction.clone() };
  const context = fixture({
    ballsRef: { current: [ball] }, firstHit: ball.id,
    shotPrediction: { ballId: ball.id, dir: alignment ? direction.clone() : direction.clone().negate(), travel: 40, railNormal: bank ? new THREE.Vector2(1, 0) : null },
    pocketCenters: () => [...pockets.values()].map(point => point.clone()),
    getPocketCenterById: id => pockets.get(id)?.clone() ?? null,
    pocketIdFromCenter: point => [...pockets].find(([, value]) => value.equals(point))?.[0],
    resolvePocketCameraAnchor: id => id,
    getPocketCameraOutward: id => pockets.get(id).clone().normalize(),
    signed: (value, fallback = 1) => Math.sign(value) || fallback,
    resolveShortRailBroadcastDirection: () => 1
  });
  for (const name of ['POCKET_CAM', 'POCKET_CAM_EARLY_TRIGGER_DIST', 'POCKET_GUARANTEED_ALIGNMENT',
    'SHORT_SHOT_CAMERA_DISTANCE', 'BROADCAST_EXCLUDE_MIDDLE_POCKET_CAMERAS',
    'POCKET_CAM_SIDE_OUTSIDE_MULTIPLIER', 'POCKET_CAM_CORNER_OUTSIDE_MULTIPLIER',
    'POCKET_VIEW_MIN_DURATION_MS']) game.evaluate(name, context);
  return {
    context, ball, center,
    follow: { orbitSnapshot: { radius: 100, phi: .4, theta: Math.PI } },
    make: game.evaluate('makePocketCameraView', context)
  };
}

function pocketSnapshot(view) {
  if (!view) return null;
  return plain(Object.fromEntries(['pocketId', 'cameraDistance', 'distanceScale', 'fixedTarget2D',
    'heightOffset', 'heightScale', 'anchorType', 'anchorId', 'holdUntil', 'railDir', 'broadcastRailDir']
    .map(key => [key, view[key]])));
}

test('direct corner pots use identical fixed pocket targets and camera distance as the ball approaches', () => {
  for (const pocket of ['TL', 'TR', 'BL', 'BR']) {
    const rigs = games.map(game => pocketFixture(game, { pocket }));
    for (const distance of [25, 18, 13]) {
      const views = rigs.map(rig => {
        rig.ball.pos.copy(rig.center).addScaledVector(rig.ball.vel, -distance);
        return rig.make(rig.ball.id, rig.follow);
      });
      assert.ok(views[0], `${pocket} direct shot is eligible for a cut`);
      assert.deepEqual(pocketSnapshot(views[1]), pocketSnapshot(views[0]));
      for (let index = 0; index < rigs.length; index++) {
        const { context, center, ball } = rigs[index];
        assert.equal(views[index].cameraDistance, context.POCKET_CAM.minOutsideShort * context.POCKET_CAM_CORNER_OUTSIDE_MULTIPLIER);
        assert.deepEqual(views[index].fixedTarget2D, center.clone().addScaledVector(ball.vel, -context.POCKET_CAM.railFocusShort));
      }
    }
  }
});

test('both games keep middle-pocket, bank and unaligned shots on broad coverage', () => {
  for (const scenario of [{ pocket: 'TM' }, { pocket: 'BM' }, { bank: true }, { alignment: false }]) {
    for (const game of games) {
      const { make, ball, follow } = pocketFixture(game, scenario);
      assert.equal(make(ball.id, follow), null, `${game.file} ${JSON.stringify(scenario)}`);
    }
  }
});

test('actual corner captures can cut after the target has stopped or crossed the pocket mouth', () => {
  const views = games.map(game => {
    const { make, ball, center, follow, context } = pocketFixture(game);
    ball.pos.copy(center);
    ball.vel.set(0, 0);
    context.shotPrediction = null;
    return make(ball.id, follow, { forceCornerCapture: true, pocketCenterOverride: center, preferredPocketId: 'TR' });
  });
  assert.ok(views[0]);
  assert.deepEqual(pocketSnapshot(views[1]), pocketSnapshot(views[0]));
});

test('remote corner cuts use observed motion rather than stale local bank or short-shot predictions', () => {
  for (const pocket of ['TL', 'TR', 'BL', 'BR']) {
    const { make, ball, context } = pocketFixture(games[1], { pocket, bank: true, alignment: false });
    context.shotPrediction.travel = 1;
    const observed = ball.vel.clone();
    ball.vel.set(0, 0); // Incoming positions, not local physics, drive a remote shot.
    const view = make(ball.id, null, { remoteDirection: observed });
    assert.equal(view?.pocketId, pocket);
    assert.equal(make(ball.id, null, { remoteDirection: new THREE.Vector2() }), null);
    assert.equal(make(ball.id, null, { remoteDirection: observed.clone().rotateAround(new THREE.Vector2(), .2) }), null,
      'a near-corner pass that misses the pocket must not cause a cut');
  }
  for (const pocket of ['TM', 'BM']) {
    const { make, ball } = pocketFixture(games[1], { pocket });
    assert.equal(make(ball.id, null, { remoteDirection: ball.vel }), null);
  }
});
