import * as THREE from 'three';

export type SpinOffset = { x: number; y: number };

export type PhysicsParams = {
  muK: number;
  muRoll: number;
  muBall: number;
  muRail: number;
  restitution: number;
  eps: number;
  g: number;
  maxSpinOffset: number;
  maxCueImpulse: number;
  ballRadius: number;
  ballMass: number;
};

export type BallState = {
  id: string;
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  omega?: THREE.Vector3;
  radius?: number;
  mass?: number;
  inertia?: number;
  active?: boolean;
  mesh?: THREE.Object3D;
  shadow?: THREE.Object3D;
  color?: string;
};

export type TableBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type PhysicsState = {
  balls: BallState[];
  params: PhysicsParams;
};

export type BallCollisionEvent = {
  a: BallState;
  b: BallState;
  impulse: number;
};

const UP = new THREE.Vector3(0, 1, 0);

export const DEFAULT_PARAMS: PhysicsParams = {
  muK: 0.2,
  muRoll: 0.015,
  muBall: 0.2,
  muRail: 0.25,
  restitution: 0.92,
  eps: 0.02,
  g: 9.81,
  maxSpinOffset: 0.7,
  maxCueImpulse: 2.8,
  ballRadius: 0.05715 / 2,
  ballMass: 0.17
};

const toVec3 = (v: THREE.Vector2) => new THREE.Vector3(v.x, 0, v.y);

export const ensureBallPhysicsState = (
  ball: BallState,
  params: PhysicsParams
) => {
  if (!ball.omega) ball.omega = new THREE.Vector3(0, 0, 0);
  if (!ball.radius) ball.radius = params.ballRadius;
  if (!ball.mass) ball.mass = params.ballMass;
  if (!ball.inertia) {
    ball.inertia = 0.4 * (ball.mass ?? params.ballMass) * (ball.radius ?? params.ballRadius) ** 2;
  }
};

const applyLinearImpulse = (ball: BallState, impulse: THREE.Vector3) => {
  if (!ball.mass) return;
  ball.vel.x += impulse.x / ball.mass;
  ball.vel.y += impulse.z / ball.mass;
};

const applyAngularImpulse = (ball: BallState, impulse: THREE.Vector3) => {
  if (!ball.omega || !ball.inertia) return;
  ball.omega.addScaledVector(impulse, 1 / ball.inertia);
};

export const createCueBall = (): BallState => {
  const radius = DEFAULT_PARAMS.ballRadius;
  const mass = DEFAULT_PARAMS.ballMass;
  return {
    id: 'cue',
    pos: new THREE.Vector2(0, 1.4),
    vel: new THREE.Vector2(0, 0),
    omega: new THREE.Vector3(0, 0, 0),
    radius,
    mass,
    inertia: 0.4 * mass * radius * radius,
    color: '#f8f8f8'
  };
};

export const createRack = (): BallState[] => {
  const radius = DEFAULT_PARAMS.ballRadius;
  const mass = DEFAULT_PARAMS.ballMass;
  const spacing = radius * 2.05;
  const baseZ = -1.3;
  const balls: BallState[] = [];
  const colors = ['#fbd34d', '#f43f5e', '#60a5fa', '#22c55e', '#fb7185'];

  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      balls.push({
        id: `rack-${row}-${i}`,
        pos: new THREE.Vector2((i - row / 2) * spacing, baseZ - row * spacing),
        vel: new THREE.Vector2(0, 0),
        omega: new THREE.Vector3(0, 0, 0),
        radius,
        mass,
        inertia: 0.4 * mass * radius * radius,
        color: colors[(row + i) % colors.length]
      });
    }
  }

  return balls;
};

export const createInitialState = (params: PhysicsParams = DEFAULT_PARAMS): PhysicsState => ({
  params,
  balls: [createCueBall(), ...createRack()]
});

export const strikeCueBall = (
  cueBall: BallState,
  direction: THREE.Vector2,
  power: number,
  spinOffset: SpinOffset,
  params: PhysicsParams
) => {
  ensureBallPhysicsState(cueBall, params);

  const dir3 = toVec3(direction).normalize();
  if (!Number.isFinite(dir3.lengthSq()) || dir3.lengthSq() < 1e-6) return;

  const clampedPower = Math.min(Math.max(power, 0), 1);
  const impulse = dir3.multiplyScalar(params.maxCueImpulse * clampedPower);
  applyLinearImpulse(cueBall, impulse);

  const right = new THREE.Vector3(-dir3.z, 0, dir3.x).normalize();
  const maxOffset = params.maxSpinOffset * (cueBall.radius ?? params.ballRadius);
  const offsetX = THREE.MathUtils.clamp(spinOffset.x, -1, 1) * maxOffset;
  const offsetY = THREE.MathUtils.clamp(spinOffset.y, -1, 1) * maxOffset;
  const rOffset = new THREE.Vector3()
    .addScaledVector(right, offsetX)
    .addScaledVector(UP, offsetY);

  const torqueImpulse = new THREE.Vector3().crossVectors(rOffset, impulse);
  applyAngularImpulse(cueBall, torqueImpulse);
};

const applyFriction = (ball: BallState, params: PhysicsParams, dt: number) => {
  if (!ball.radius || !ball.mass) return;
  const rContact = new THREE.Vector3(0, -ball.radius, 0);
  const omega = ball.omega ?? new THREE.Vector3(0, 0, 0);
  const vContact = toVec3(ball.vel).add(new THREE.Vector3().crossVectors(omega, rContact));
  const vRel = new THREE.Vector3(vContact.x, 0, vContact.z);
  const relSpeed = vRel.length();

  if (relSpeed > params.eps) {
    const frictionDir = vRel.normalize().multiplyScalar(-1);
    const frictionForce = frictionDir.multiplyScalar(params.muK * ball.mass * params.g);
    const linearImpulse = frictionForce.clone().multiplyScalar(dt);
    applyLinearImpulse(ball, linearImpulse);

    const torqueImpulse = new THREE.Vector3().crossVectors(rContact, linearImpulse);
    applyAngularImpulse(ball, torqueImpulse);
  } else {
    const speed = ball.vel.length();
    if (speed > 0) {
      const rollingForce = ball.vel.clone().normalize().multiplyScalar(-params.muRoll * ball.mass * params.g);
      const rollingImpulse = rollingForce.multiplyScalar(dt);
      applyLinearImpulse(ball, new THREE.Vector3(rollingImpulse.x, 0, rollingImpulse.y));
    }
  }

  if (ball.vel.length() < 0.002 && (ball.omega?.length() ?? 0) < 0.2) {
    ball.vel.set(0, 0);
    if (ball.omega) {
      ball.omega.multiplyScalar(0.5);
      if (ball.omega.length() < 0.05) {
        ball.omega.set(0, 0, 0);
      }
    }
  }
};

const resolveBallBallCollision = (
  a: BallState,
  b: BallState,
  params: PhysicsParams
): BallCollisionEvent | null => {
  if (!a.radius || !b.radius || !a.mass || !b.mass) return null;
  const delta = new THREE.Vector2().subVectors(b.pos, a.pos);
  const dist = delta.length();
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist <= 0) return null;

  const normal = delta.clone().multiplyScalar(1 / dist);
  const penetration = minDist - dist;
  a.pos.addScaledVector(normal, -penetration / 2);
  b.pos.addScaledVector(normal, penetration / 2);

  const n3 = new THREE.Vector3(normal.x, 0, normal.y);
  const rA = n3.clone().multiplyScalar(a.radius);
  const rB = n3.clone().multiplyScalar(-b.radius);

  const omegaA = a.omega ?? new THREE.Vector3(0, 0, 0);
  const omegaB = b.omega ?? new THREE.Vector3(0, 0, 0);

  const vRel = toVec3(a.vel)
    .add(new THREE.Vector3().crossVectors(omegaA, rA))
    .sub(toVec3(b.vel).add(new THREE.Vector3().crossVectors(omegaB, rB)));

  const vn = vRel.dot(n3);
  if (vn >= 0) return null;

  const invMassSum = 1 / a.mass + 1 / b.mass;
  const jn = (-(1 + params.restitution) * vn) / invMassSum;
  const impulseN = n3.clone().multiplyScalar(jn);

  applyLinearImpulse(a, impulseN.clone().multiplyScalar(-1));
  applyLinearImpulse(b, impulseN.clone().multiplyScalar(1));

  const vt = vRel.clone().sub(n3.clone().multiplyScalar(vn));
  const vtMag = vt.length();
  if (vtMag < 1e-6) {
    return { a, b, impulse: Math.abs(jn) };
  }

  const tDir = vt.multiplyScalar(1 / vtMag);
  let jt = -vtMag / invMassSum;
  const maxJt = params.muBall * jn;
  jt = THREE.MathUtils.clamp(jt, -maxJt, maxJt);
  const impulseT = tDir.clone().multiplyScalar(jt);

  applyLinearImpulse(a, impulseT.clone().multiplyScalar(-1));
  applyLinearImpulse(b, impulseT.clone().multiplyScalar(1));

  applyAngularImpulse(a, new THREE.Vector3().crossVectors(rA, impulseT).multiplyScalar(-1));
  applyAngularImpulse(b, new THREE.Vector3().crossVectors(rB, impulseT));

  return { a, b, impulse: Math.abs(jn) };
};

const resolveRailCollision = (
  ball: BallState,
  table: TableBounds,
  params: PhysicsParams
) => {
  if (!ball.radius || !ball.mass) return false;
  const { radius } = ball;
  const minX = table.minX + radius;
  const maxX = table.maxX - radius;
  const minZ = table.minZ + radius;
  const maxZ = table.maxZ - radius;

  const v3 = toVec3(ball.vel);

  const collisions: Array<{ normal: THREE.Vector3 }> = [];

  if (ball.pos.x < minX) {
    ball.pos.x = minX;
    collisions.push({ normal: new THREE.Vector3(1, 0, 0) });
  } else if (ball.pos.x > maxX) {
    ball.pos.x = maxX;
    collisions.push({ normal: new THREE.Vector3(-1, 0, 0) });
  }

  if (ball.pos.y < minZ) {
    ball.pos.y = minZ;
    collisions.push({ normal: new THREE.Vector3(0, 0, 1) });
  } else if (ball.pos.y > maxZ) {
    ball.pos.y = maxZ;
    collisions.push({ normal: new THREE.Vector3(0, 0, -1) });
  }

  let hit = false;

  for (const { normal } of collisions) {
    const rContact = normal.clone().multiplyScalar(radius);
    const omega = ball.omega ?? new THREE.Vector3(0, 0, 0);
    const vContact = v3.clone().add(new THREE.Vector3().crossVectors(omega, rContact));
    const vn = vContact.dot(normal);
    if (vn >= 0) continue;

    const jn = -(1 + params.restitution) * vn * ball.mass;
    const impulseN = normal.clone().multiplyScalar(jn);
    applyLinearImpulse(ball, impulseN);

    const vt = vContact.clone().sub(normal.clone().multiplyScalar(vn));
    const vtMag = vt.length();
    if (vtMag > 1e-6) {
      const tDir = vt.multiplyScalar(1 / vtMag);
      let jt = -vtMag * ball.mass;
      const maxJt = params.muRail * jn;
      jt = THREE.MathUtils.clamp(jt, -maxJt, maxJt);
      const impulseT = tDir.multiplyScalar(jt);
      applyLinearImpulse(ball, impulseT);
      applyAngularImpulse(ball, new THREE.Vector3().crossVectors(rContact, impulseT));
    }
    hit = true;
  }

  return hit;
};

export const stepPhysics = (
  balls: BallState[],
  params: PhysicsParams,
  dt: number,
  table: TableBounds
) => {
  const collisions: BallCollisionEvent[] = [];
  const railContacts: BallState[] = [];

  balls.forEach((ball) => {
    if (ball.active === false) return;
    ensureBallPhysicsState(ball, params);
    applyFriction(ball, params, dt);
  });

  balls.forEach((ball) => {
    if (ball.active === false) return;
    ball.pos.addScaledVector(ball.vel, dt);
    if (resolveRailCollision(ball, table, params)) {
      railContacts.push(ball);
    }
  });

  for (let i = 0; i < balls.length; i += 1) {
    const a = balls[i];
    if (a.active === false) continue;
    for (let j = i + 1; j < balls.length; j += 1) {
      const b = balls[j];
      if (b.active === false) continue;
      const collision = resolveBallBallCollision(a, b, params);
      if (collision) collisions.push(collision);
    }
  }

  return { collisions, railContacts };
};

export const resetState = (state: PhysicsState) => {
  const fresh = createInitialState(state.params);
  state.balls = fresh.balls;
};
