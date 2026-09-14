import fs from 'fs';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import {
  MAX_SPIN_OFFSET, MAX_CUE_TIP_OFFSET_RATIO, normalizeSpinInput,
  mapSpinForPhysics, spinFromScreenPoint, resolvePoolRoyalCueStrike,
  stepPoolRoyalClothSpin, resolvePoolRoyalCushionSpin,
  hasPoolRoyalPlanarSlip, isPoolRoyalBallMoving
} from '../webapp/src/pages/Games/poolRoyaleSpinUtils.js';

const radius = 0.05;
const strike = (spin, direction = { x: 0, y: 1 }) =>
  resolvePoolRoyalCueStrike({ spin, direction, speed: 1, radius });
const energy = ({ velocity, omega }) =>
  (velocity.x ** 2 + velocity.y ** 2) / 2 +
  radius ** 2 / 5 * (omega.x ** 2 + omega.y ** 2 + omega.z ** 2);
const cloth = (state, dt = 0.05) => stepPoolRoyalClothSpin({ ...state, radius, dt });

describe('Pool Royale screen spin controller', () => {
  it('keeps the center neutral through repeated UI and physics conversions', () => {
    expect(mapSpinForPhysics({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    let selected = { x: 0.18, y: -0.31 };
    for (let i = 0; i < 100; i++) selected = mapSpinForPhysics(normalizeSpinInput(selected));
    expect(selected).toEqual({ x: 0.18, y: -0.31 });
  });

  it.each([
    [100, 60, 0, 1], [100, 140, 0, -1], [60, 100, -1, 0], [140, 100, 1, 0],
    [75, 75, -1, 1], [125, 75, 1, 1], [75, 125, -1, -1], [125, 125, 1, -1]
  ])('preserves the visible direction for screen point (%s, %s)', (x, y, sx, sy) => {
    const value = spinFromScreenPoint(x, y, { left: 50, top: 50, width: 100, height: 100 });
    expect(Math.sign(value.x)).toBe(sx);
    expect(Math.sign(value.y)).toBe(sy);
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      expect(mapSpinForPhysics(value, {
        cameraRight: { x: Math.cos(heading), y: 0, z: Math.sin(heading) },
        cameraUp: { x: 0, y: 1, z: 0 }, cueForward: { x: 0, y: 0, z: 1 }
      })).toEqual(value);
    }
  });

  it('keeps continuous proportional offsets, including values between old snap rings', () => {
    const selected = { x: 0.17, y: 0.23 };
    expect(normalizeSpinInput(selected)).toEqual(selected);
    expect(normalizeSpinInput({ x: selected.x * 2, y: selected.y * 2 }))
      .toEqual({ x: selected.x * 2, y: selected.y * 2 });
    expect(normalizeSpinInput({ x: 0.001, y: -0.002 })).toEqual({ x: 0.001, y: -0.002 });
    const diagonal = normalizeSpinInput({ x: 1, y: 1 });
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(MAX_SPIN_OFFSET, 12);
    expect(diagonal.x).toBeCloseTo(diagonal.y, 12);
  });

  it('sanitizes invalid or oversized input without corrupting valid axes', () => {
    for (const value of [NaN, Infinity, -Infinity, undefined, 'bad']) {
      expect(normalizeSpinInput({ x: value, y: 0.2 })).toEqual({ x: 0, y: 0.2 });
    }
    const giant = normalizeSpinInput({ x: Number.MAX_VALUE, y: Number.MAX_VALUE });
    expect(Math.hypot(giant.x, giant.y)).toBeCloseTo(MAX_SPIN_OFFSET, 12);
    expect(spinFromScreenPoint(1, 1, { width: 0, height: 1 })).toEqual({ x: 0, y: 0 });
    expect(Number.isFinite(strike({ x: 0.2, y: 0.3 }, { x: NaN, y: 1 }).velocity.x)).toBe(true);
  });
});

describe('Pool Royale cue momentum and contact response', () => {
  it('starts a center strike with zero omega and naturally reaches rolling on cloth', () => {
    const initial = strike({ x: 0, y: 0 });
    expect(initial.omega.x).toBe(0);
    expect(initial.omega.y).toBe(0);
    expect(Math.abs(initial.omega.z)).toBe(0);
    expect(initial.velocity).toEqual({ x: 0, y: 1 });
    const slid = cloth(initial, 0.3);
    expect(slid.omega.x).toBeGreaterThan(0);
    expect(slid.velocity.y).toBeLessThan(initial.velocity.y);
    expect(slid.velocity.y - radius * slid.omega.x).toBeCloseTo(0, 12);
    expect(energy(slid)).toBeLessThan(energy(initial));
  });

  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('follow and draw work at heading %s', (heading) => {
    const direction = { x: Math.sin(heading), y: Math.cos(heading) };
    for (const sign of [-1, 1]) {
      const launched = strike({ x: 0, y: sign * MAX_SPIN_OFFSET }, direction);
      // A full object-ball hit removes the cue's linear momentum, retaining spin.
      const afterContact = cloth({ velocity: { x: 0, y: 0 }, omega: launched.omega });
      const alongShot = afterContact.velocity.x * direction.x + afterContact.velocity.y * direction.y;
      expect(Math.sign(alongShot)).toBe(sign);
      expect(energy(afterContact)).toBeLessThan(energy({ velocity: { x: 0, y: 0 }, omega: launched.omega }));
    }
  });

  it('uses a circular .45R contact limit and gives no initial sidespin drift', () => {
    const center = strike({ x: 0, y: 0 });
    const side = strike({ x: MAX_SPIN_OFFSET, y: 0 });
    const mixed = strike({ x: MAX_SPIN_OFFSET, y: MAX_SPIN_OFFSET });
    expect(side.velocity.x).toBe(0);
    expect(cloth(side).velocity.x).toBe(0);
    expect(side.velocity.y).toBeCloseTo(1 - 0.25 * MAX_CUE_TIP_OFFSET_RATIO ** 2, 12);
    expect(mixed.velocity.y).toBeCloseTo(side.velocity.y, 12);
    expect(energy(side)).toBeGreaterThan(energy(center)); // tip adds angular energy as well as translation
    expect(side.omega.y).toBeCloseTo(2.5 * side.velocity.y * MAX_CUE_TIP_OFFSET_RATIO / radius, 12);
  });

  it('produces mirrored left/right cushion kick with no energy gain', () => {
    const left = strike({ x: -MAX_SPIN_OFFSET, y: 0 });
    const right = strike({ x: MAX_SPIN_OFFSET, y: 0 });
    const rebound = (state) => resolvePoolRoyalCushionSpin({
      ...state, normal: { x: 0, y: -1 }, radius, restitution: 1.012
    });
    const a = rebound(left);
    const b = rebound(right);
    // Facing +Z with Y up: screen-right is world -X.
    expect(a.velocity.x).toBeGreaterThan(0);
    expect(b.velocity.x).toBeLessThan(0);
    expect(a.velocity.x).toBeCloseTo(-b.velocity.x, 12);
    expect(a.velocity.y).toBeLessThan(0);
    expect(energy(a)).toBeLessThanOrEqual(energy(left));
    expect(energy(b)).toBeLessThanOrEqual(energy(right));
    expect(Math.abs(b.omega.y)).toBeLessThan(Math.abs(right.omega.y));
  });

  it('settles without oscillation and preserves step subdivision through slide-to-roll', () => {
    const initial = strike({ x: 0.2, y: -0.1 });
    const whole = cloth(initial, 0.4);
    let split = initial;
    for (let i = 0; i < 40; i++) split = cloth(split, 0.01);
    for (const axis of ['x', 'y']) expect(split.velocity[axis]).toBeCloseTo(whole.velocity[axis], 10);
    for (const axis of ['x', 'y', 'z']) expect(split.omega[axis]).toBeCloseTo(whole.omega[axis], 10);
    let stopped = initial;
    for (let i = 0; i < 200; i++) stopped = cloth(stopped, 0.05);
    expect(stopped.velocity).toEqual({ x: 0, y: 0 });
    expect(Math.abs(stopped.omega.x) + Math.abs(stopped.omega.z)).toBe(0);
  });
});

// Run the real game's strike and rail wrappers without booting WebGL/Telegram.
const source = fs.readFileSync('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const findNode = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    const match = Array.isArray(value)
      ? value.map(child => findNode(child, predicate)).find(Boolean)
      : findNode(value, predicate);
    if (match) return match;
  }
  return null;
};
const loadGameFunction = (name, scope) => {
  const node = findNode(ast, node =>
    (node.type === 'VariableDeclarator' || node.type === 'FunctionDeclaration') && node.id?.name === name);
  const callable = node.type === 'VariableDeclarator' ? node.init : node;
  return new Function(...Object.keys(scope), `let maxPowerLiftTriggered = false; return (${source.slice(callable.start, callable.end)});`)(...Object.values(scope));
};

describe('Pool Royale actual shot integration', () => {
  it('applies the selected offset once at strike, resets the dial and ignores repeated impact', () => {
    const cue = { vel: new THREE.Vector2(), omega: new THREE.Vector3(), spin: new THREE.Vector2(),
      pendingSpin: new THREE.Vector2(), pos: new THREE.Vector2() };
    const reset = jest.fn();
    const apply = loadGameFunction('applyShotAtImpact', { cue, THREE, resolvePoolRoyalCueStrike,
      BALL_R: radius, LIVE_CUE_FORWARD_DURATION_MS: 80, resetSpinRef: { current: reset },
      cueLiftRef: { current: {} }, playCueHit: () => {}, spawnCueImpactDust: () => {}, CUE_Y: radius });
    const payload = { base: new THREE.Vector2(0, 1), aimDir: new THREE.Vector2(0, 1),
      physicsSpin: { x: 0.17, y: -0.31 }, clampedPower: 1 };
    apply(payload);
    const expected = strike(payload.physicsSpin);
    expect(cue.vel.toArray()).toEqual([expected.velocity.x, expected.velocity.y]);
    expect(cue.omega.toArray()).toEqual([expected.omega.x, expected.omega.y, expected.omega.z]);
    expect(cue.spin.toArray()).toEqual([0.17, -0.31]);
    expect(reset).toHaveBeenCalledTimes(1);
    apply(payload);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('uses incoming rail velocity even when boundary fallback already reflected the ball', () => {
    const launched = strike({ x: MAX_SPIN_OFFSET, y: 0 });
    const ball = { vel: new THREE.Vector2(0, -launched.velocity.y),
      omega: new THREE.Vector3(launched.omega.x, launched.omega.y, launched.omega.z) };
    const impact = { type: 'rail', normal: new THREE.Vector2(0, -1),
      preImpactVel: new THREE.Vector2(launched.velocity.x, launched.velocity.y) };
    const apply = loadGameFunction('applyRailImpulse', { THREE, resolvePoolRoyalCushionSpin,
      clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
      BALL_R: radius, CUSHION_RESTITUTION: 1, RAIL_FRICTION: 0.16 });
    apply(ball, impact);
    expect(ball.vel.x).toBeLessThan(0);
    expect(ball.vel.y).toBeLessThan(0);
    expect(ball.omega.y).toBeLessThan(launched.omega.y);
  });
});


describe('Pool Royale actual frame and stopping integration', () => {
  const stopSpeed = 0.0074 * 0.35;
  const scope = {
    stepPoolRoyalClothSpin, hasPoolRoyalPlanarSlip, isPoolRoyalBallMoving,
    BALL_R: radius, SPIN_FIXED_DT: 1 / 120, SPIN_KINETIC_FRICTION: 0.126,
    ROLLING_RESISTANCE: 0.0098, SPIN_GRAVITY: 9.81, SPIN_ANGULAR_DAMPING: 0.04,
    STOP_FINAL_EPS: stopSpeed, STOP_EPS: 0.0074, STOP_SOFTENING: 0.96,
    PHYSICS_BASE_STEP: 1 / 60, MAX_FRAME_SCALE: 2.4, MIN_FRAME_SCALE: 1e-6,
    MAX_PHYSICS_SUBSTEPS: 5
  };
  const step = loadGameFunction('stepPoolRoyalBallMotion', scope);
  const clock = loadGameFunction('resolvePoolRoyalPhysicsFrameStep', scope);
  const stopped = loadGameFunction('allStopped', scope);

  it.each([-1, 1])('retains post-contact draw/follow (%s) at 30, 60 and 120 Hz', (sign) => {
    const outcomes = [30, 60, 120].map(fps => {
      const launched = strike({ x: 0, y: sign * MAX_SPIN_OFFSET });
      const ball = { id: 'cue', active: true, pos: new THREE.Vector2(), vel: new THREE.Vector2(),
        omega: new THREE.Vector3(launched.omega.x, launched.omega.y, launched.omega.z) };
      // Immediately after a full collision velocity is 0, but this is not settled.
      expect(stopped([ball])).toBe(false);
      const timing = clock(1000 / fps);
      expect(timing.frameScale).toBeCloseTo(60 / fps, 12);
      for (let frame = 0; frame < fps / 10; frame++) {
        for (let substep = 0; substep < timing.physicsSubsteps; substep++) {
          step(ball, timing.subStepScale);
          expect(Math.sign(ball.vel.y)).toBe(sign);
          expect(stopped([ball])).toBe(false);
        }
      }
      expect(Math.sign(ball.pos.y)).toBe(sign);
      return ball;
    });
    for (const ball of outcomes.slice(1)) {
      expect(ball.vel.y).toBeCloseTo(outcomes[0].vel.y, 12);
      expect(ball.omega.x).toBeCloseTo(outcomes[0].omega.x, 12);
      // Existing position integration is first order; bound cadence rounding.
      expect(Math.abs(ball.pos.y - outcomes[0].pos.y)).toBeLessThan(radius / 2);
    }
  });

  it('does not postpone the next turn for side spin without cloth motion', () => {
    const ball = { id: 'cue', active: true, pos: new THREE.Vector2(), vel: new THREE.Vector2(),
      omega: new THREE.Vector3(0, 100, 0) };
    expect(stopped([ball])).toBe(true);
    step(ball, 0.5);
    expect(ball.pos.toArray()).toEqual([0, 0]);
    expect(stopped([ball])).toBe(true);
  });

  it('does not let a moving or airborne ball end the shot at smaller frame steps', () => {
    const rolling = { active: true, vel: new THREE.Vector2(0, stopSpeed * 1.5),
      omega: new THREE.Vector3(stopSpeed * 1.5 / radius, 0, 0) };
    expect(stopped([rolling])).toBe(false);
    expect(stopped([{ active: true, vel: new THREE.Vector2(), lift: radius }])).toBe(false);
    expect(stopped([{ ...rolling, active: false }])).toBe(true);
  });
});
