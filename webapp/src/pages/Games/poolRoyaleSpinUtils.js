const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const MAX_SPIN_OFFSET = 0.75;
export const SPIN_STUN_RADIUS = 0;
export const SPIN_RING1_RADIUS = 0.33;
export const SPIN_RING2_RADIUS = 0.66;
export const SPIN_RING3_RADIUS = MAX_SPIN_OFFSET;
export const SPIN_LEVEL0_MAG = 0;
export const SPIN_LEVEL1_MAG = SPIN_RING1_RADIUS;
export const SPIN_LEVEL2_MAG = SPIN_RING2_RADIUS;
export const SPIN_LEVEL3_MAG = SPIN_RING3_RADIUS;
export const STRAIGHT_SPIN_DEADZONE = 0;
export const SPIN_RESPONSE_EXPONENT = 1;
export const SPIN_CENTER_TOPSPIN_BIAS = 0;
// Controller coordinates describe the front of the cue ball on the screen.
// The physical tip is limited to 45% of the ball radius to avoid miscues.
export const MAX_CUE_TIP_OFFSET_RATIO = 0.45;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
export const SPIN_DIRECTIONS = [
  {
    id: 'stun',
    label: 'STUN (no spin)',
    offset: { x: 0, y: 0 },
    effect:
      'Goditje në qendër: cue ball rrëshqet fillimisht dhe kalon në rolling pa topspin/backspin.'
  },
  {
    id: 'topspin',
    label: 'TOPSPIN (follow)',
    offset: { x: 0, y: MAX_SPIN_OFFSET },
    effect:
      'Goditje sipër qendrës: spin rreth boshtit horizontal në drejtim të lëvizjes, cue ball vazhdon përpara pas kontaktit.'
  },
  {
    id: 'backspin',
    label: 'BACKSPIN (draw)',
    offset: { x: 0, y: -MAX_SPIN_OFFSET },
    effect:
      'Goditje poshtë qendrës: spin rreth boshtit horizontal në drejtim të kundërt, cue ball ndalon dhe kthehet mbrapsht pas kontaktit.'
  },
  {
    id: 'left-english',
    label: 'SIDESPIN LEFT',
    offset: { x: -MAX_SPIN_OFFSET, y: 0 },
    effect:
      'Goditje majtas nga qendra: spin rreth boshtit vertikal, ndikon kryesisht në rebound me banda dhe në “throw”.'
  },
  {
    id: 'right-english',
    label: 'SIDESPIN RIGHT',
    offset: { x: MAX_SPIN_OFFSET, y: 0 },
    effect:
      'Goditje djathtas nga qendra: spin rreth boshtit vertikal në drejtim të kundërt, me të njëjtat efekte anësore.'
  },
  {
    id: 'top-left',
    label: 'TOPSPIN + LEFT',
    offset: { x: -SPIN_RING2_RADIUS, y: SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal sipër-majtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'top-right',
    label: 'TOPSPIN + RIGHT',
    offset: { x: SPIN_RING2_RADIUS, y: SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal sipër-djathtas: follow me efekt në banda dhe cut shots, me spin lateral aktiv.'
  },
  {
    id: 'back-left',
    label: 'BACKSPIN + LEFT',
    offset: { x: -SPIN_RING2_RADIUS, y: -SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal poshtë-majtas: draw me kontroll lateral pas kontaktit dhe reagim më agresiv me bandat.'
  },
  {
    id: 'back-right',
    label: 'BACKSPIN + RIGHT',
    offset: { x: SPIN_RING2_RADIUS, y: -SPIN_RING2_RADIUS },
    effect:
      'Offset diagonal poshtë-djathtas: draw me kontroll lateral pas kontaktit dhe reagim më agresiv me bandat.'
  }
];

export const clampToMaxOffset = (x, y, maxOffset = MAX_SPIN_OFFSET) => {
  x = finite(x);
  y = finite(y);
  const limit = Math.max(0, finite(maxOffset, MAX_SPIN_OFFSET));
  // Scale first so even very large finite network/pointer inputs cannot overflow.
  const largest = Math.max(Math.abs(x), Math.abs(y));
  if (largest === 0 || limit === 0) return { x: 0, y: 0 };
  const scaledLength = Math.hypot(x / largest, y / largest);
  if (largest <= limit / scaledLength) return { x, y };
  return { x: (x / largest) * limit / scaledLength, y: (y / largest) * limit / scaledLength };
};

export const clampToUnitCircle = (x, y) => clampToMaxOffset(x, y, 1);

export const computeQuantizedOffsetScaled = (
  rawX,
  rawY,
  options = {}
) => {
  const maxOffset = options.maxOffset ?? MAX_SPIN_OFFSET;
  const stunRadius = options.stunRadius ?? SPIN_STUN_RADIUS;
  const ring1Radius = options.ring1Radius ?? SPIN_RING1_RADIUS;
  const ring2Radius = options.ring2Radius ?? SPIN_RING2_RADIUS;
  const ring3Radius = options.ring3Radius ?? SPIN_RING3_RADIUS;
  const level0Mag = options.level0Mag ?? SPIN_LEVEL0_MAG;
  const level1Mag = options.level1Mag ?? SPIN_LEVEL1_MAG;
  const level2Mag = options.level2Mag ?? SPIN_LEVEL2_MAG;
  const level3Mag = options.level3Mag ?? SPIN_LEVEL3_MAG;
  const angleStep = options.angleStepRad ?? Math.PI / 4;

  const raw = clampToMaxOffset(rawX, rawY, maxOffset);
  const distance = Math.hypot(raw.x, raw.y);
  let mag = level3Mag;
  if (distance <= stunRadius) {
    mag = level0Mag;
  } else if (distance <= ring1Radius) {
    mag = level1Mag;
  } else if (distance <= ring2Radius) {
    mag = level2Mag;
  } else if (distance <= ring3Radius) {
    mag = level3Mag;
  }
  if (mag === 0 || distance <= 1e-6) {
    return { x: 0, y: 0 };
  }
  const angle = Math.atan2(raw.y, raw.x);
  const snappedAngle = angleStep > 0
    ? Math.round(angle / angleStep) * angleStep
    : angle;
  return {
    x: Math.cos(snappedAngle) * mag,
    y: Math.sin(snappedAngle) * mag
  };
};

// Idempotent: passing the value through UI, preview and strike cannot reduce it.
export const normalizeSpinInput = (spin) =>
  clampToMaxOffset(spin?.x, spin?.y);

// Spin is selected on a fixed front-view dial. Camera orbit must never rotate,
// erase or reverse a chosen left/right or top/back offset.
export const mapUiOffsetToCueFrame = (uiX, uiY) =>
  normalizeSpinInput({ x: uiX, y: uiY });

export const mapSpinForPhysics = (spin) => normalizeSpinInput(spin);

export const spinFromScreenPoint = (clientX, clientY, rect) => {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return { x: 0, y: 0 };
  const x = (finite(clientX, rect.left + rect.width / 2) - rect.left) / rect.width * 2 - 1;
  const y = 1 - (finite(clientY, rect.top + rect.height / 2) - rect.top) / rect.height * 2;
  return normalizeSpinInput({ x, y });
};

// Independently implemented solid-sphere impulse, with no initial lateral drift.
// velocity is in the game's X/Z table plane; omega uses Three.js X/Y/Z axes.
export const resolvePoolRoyalCueStrike = ({ spin, direction, speed, radius } = {}) => {
  const offset = normalizeSpinInput(spin);
  const tipScale = MAX_CUE_TIP_OFFSET_RATIO / MAX_SPIN_OFFSET;
  const side = offset.x * tipScale;
  const top = offset.y * tipScale;
  const safeRadius = Math.max(1e-6, finite(radius, 1));
  const directionX = finite(direction?.x);
  const directionZ = finite(direction?.y);
  const length = Math.hypot(directionX, directionZ);
  const dx = length > 1e-8 ? directionX / length : 0;
  const dz = length > 1e-8 ? directionZ / length : 1;
  const launchSpeed = Math.max(0, finite(speed)) * (1 - 0.25 * (side * side + top * top));
  const angularScale = 2.5 * launchSpeed / safeRadius;
  return {
    velocity: { x: dx * launchSpeed, y: dz * launchSpeed },
    omega: { x: dz * top * angularScale, y: side * angularScale, z: -dx * top * angularScale },
    offset
  };
};

// Friction consumes slip at the cloth contact, then continues as natural roll.
// Capping the impulse at slip / (1 + mR²/I) prevents small-step oscillation.
export const stepPoolRoyalClothSpin = ({ velocity, omega, radius, dt,
  slidingFriction = 0.126, rollingFriction = 0.0098, gravity = 9.81,
  spinDamping = 0.04 } = {}) => {
  const r = Math.max(1e-6, finite(radius, 1));
  const step = Math.max(0, finite(dt));
  let vx = finite(velocity?.x);
  let vz = finite(velocity?.y);
  let wx = finite(omega?.x);
  let wz = finite(omega?.z);
  const wy = finite(omega?.y) * Math.exp(-Math.max(0, finite(spinDamping)) * step);
  const slipX = vx + r * wz;
  const slipZ = vz - r * wx;
  const slip = Math.hypot(slipX, slipZ);
  const acceleration = Math.max(0, finite(slidingFriction) * finite(gravity));
  let rollingTime = step;
  if (slip > 1e-10) {
    const delta = Math.min(acceleration * step, slip / 3.5);
    const dvx = -slipX / slip * delta;
    const dvz = -slipZ / slip * delta;
    vx += dvx;
    vz += dvz;
    wx -= 2.5 * dvz / r;
    wz += 2.5 * dvx / r;
    rollingTime = acceleration > 0 && delta >= slip / 3.5 - 1e-12
      ? Math.max(0, step - delta / acceleration) : 0;
  }
  if (rollingTime > 0) {
    const speed = Math.hypot(vx, vz);
    const decel = Math.max(0, finite(rollingFriction) * finite(gravity)) * rollingTime;
    const factor = speed > 1e-10 ? Math.max(0, speed - decel) / speed : 0;
    vx *= factor;
    vz *= factor;
    wx = vz / r;
    wz = -vx / r;
  }
  return { velocity: { x: vx, y: vz }, omega: { x: wx, y: wy, z: wz } };
};

// Side spin alone cannot move a stationary ball across level cloth. Planar
// slip can still produce follow/draw even immediately after velocity reaches 0.
export const hasPoolRoyalPlanarSlip = (velocity, omega, radius, threshold = 1e-6) => {
  const r = Math.max(0, finite(radius));
  return Math.hypot(
    finite(velocity?.x) + r * finite(omega?.z),
    finite(velocity?.y) - r * finite(omega?.x)
  ) > Math.max(0, finite(threshold));
};

export const isPoolRoyalBallMoving = (ball, radius, stopSpeed = 0.00259) => {
  if (!ball || ball.active === false) return false;
  const threshold = Math.max(0, finite(stopSpeed, 0.00259));
  return Math.hypot(finite(ball.vel?.x), finite(ball.vel?.y)) >= threshold ||
    hasPoolRoyalPlanarSlip(ball.vel, ball.omega, radius, threshold) ||
    finite(ball.lift) > 1e-6 || Math.abs(finite(ball.liftVel)) > 1e-6;
};

// A cushion's normal points into the table, so contact is at -normal * R.
// Side spin changes tangential rebound through one bounded friction impulse.
export const resolvePoolRoyalCushionSpin = ({ velocity, omega, normal, radius,
  restitution = 1, friction = 0.16 } = {}) => {
  let vx = finite(velocity?.x);
  let vz = finite(velocity?.y);
  let wy = finite(omega?.y);
  const wx = finite(omega?.x);
  const wz = finite(omega?.z);
  const r = Math.max(1e-6, finite(radius, 1));
  const normalX = finite(normal?.x);
  const normalZ = finite(normal?.y);
  const length = Math.hypot(normalX, normalZ);
  if (length > 1e-8) {
    const nx = normalX / length;
    const nz = normalZ / length;
    const incoming = vx * nx + vz * nz;
    if (incoming < 0) {
      const normalDelta = -(1 + clamp(finite(restitution, 1), 0, 1)) * incoming;
      const tangentSlip = -nz * vx + nx * vz + r * wy;
      const bound = Math.max(0, finite(friction)) * normalDelta;
      const tangentDelta = clamp(-tangentSlip / 3.5, -bound, bound);
      vx += nx * normalDelta - nz * tangentDelta;
      vz += nz * normalDelta + nx * tangentDelta;
      wy += 2.5 * tangentDelta / r;
    }
  }
  return { velocity: { x: vx, y: vz }, omega: { x: wx, y: wy, z: wz } };
};

// Smooth damp helper adapted from Unity's Mathf.SmoothDamp (MIT licensed).
export const smoothDamp = (
  current,
  target,
  currentVelocity,
  smoothTime,
  maxSpeed,
  deltaTime
) => {
  const clampedSmooth = Math.max(0.0001, smoothTime || 0);
  const omega = 2 / clampedSmooth;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTarget = target;
  const maxChange = (maxSpeed ?? Number.POSITIVE_INFINITY) * clampedSmooth;
  if (Number.isFinite(maxChange)) {
    change = clamp(change, -maxChange, maxChange);
  }
  target = current - change;
  const temp = (currentVelocity + omega * change) * deltaTime;
  let velocity = (currentVelocity - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  if ((originalTarget - current > 0) === (output > originalTarget)) {
    output = originalTarget;
    velocity = (output - originalTarget) / Math.max(deltaTime, 1e-4);
  }
  return { value: output, velocity };
};
