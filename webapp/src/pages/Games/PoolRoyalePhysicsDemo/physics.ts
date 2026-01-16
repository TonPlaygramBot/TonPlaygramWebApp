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
};

export type BallState = {
  id: string;
  position: THREE.Vector2;
  velocity: THREE.Vector2;
  omega: THREE.Vector3;
  radius: number;
  mass: number;
  inertia: number;
  color: string;
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

export const DEFAULT_PARAMS: PhysicsParams = {
  muK: 0.2,
  muRoll: 0.015,
  muBall: 0.2,
  muRail: 0.25,
  restitution: 0.92,
  eps: 0.02,
  g: 9.81,
  maxSpinOffset: 0.7,
  maxCueImpulse: 2.8
};

export const DEFAULT_TABLE: TableBounds = {
  minX: -1.2,
  maxX: 1.2,
  minZ: -2.2,
  maxZ: 2.2
};

const UP = new THREE.Vector3(0, 1, 0);

const toVec3 = (v: THREE.Vector2) => new THREE.Vector3(v.x, 0, v.y);

const applyLinearImpulse = (ball: BallState, impulse: THREE.Vector3) => {
  ball.velocity.x += impulse.x / ball.mass;
  ball.velocity.y += impulse.z / ball.mass;
};

const applyAngularImpulse = (ball: BallState, impulse: THREE.Vector3) => {
  ball.omega.addScaledVector(impulse, 1 / ball.inertia);
};

export const createCueBall = (): BallState => {
  const radius = 0.05715 / 2;
  const mass = 0.17;
  return {
    id: 'cue',
    position: new THREE.Vector2(0, 1.4),
    velocity: new THREE.Vector2(0, 0),
    omega: new THREE.Vector3(0, 0, 0),
    radius,
    mass,
    inertia: 0.4 * mass * radius * radius,
    color: '#f8f8f8'
  };
};

export const createRack = (): BallState[] => {
  const radius = 0.05715 / 2;
  const mass = 0.17;
  const spacing = radius * 2.05;
  const baseZ = -1.3;
  const balls: BallState[] = [];
  const colors = ['#fbd34d', '#f43f5e', '#60a5fa', '#22c55e', '#fb7185'];

  for (let row = 0; row < 3; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      balls.push({
        id: `rack-${row}-${i}`,
        position: new THREE.Vector2((i - row / 2) * spacing, baseZ - row * spacing),
        velocity: new THREE.Vector2(0, 0),
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
  state: PhysicsState,
  direction: THREE.Vector2,
  power: number,
  spinOffset: SpinOffset
) => {
  const cueBall = state.balls.find((ball) => ball.id === 'cue');
  if (!cueBall) return;

  const dir3 = toVec3(direction).normalize();
  if (!Number.isFinite(dir3.lengthSq()) || dir3.lengthSq() < 1e-6) return;

  const clampedPower = Math.min(Math.max(power, 0), 1);
  const impulse = dir3.multiplyScalar(state.params.maxCueImpulse * clampedPower);
  applyLinearImpulse(cueBall, impulse);

  const right = new THREE.Vector3(-dir3.z, 0, dir3.x).normalize();
  const maxOffset = state.params.maxSpinOffset * cueBall.radius;
  const offsetX = THREE.MathUtils.clamp(spinOffset.x, -1, 1) * maxOffset;
  const offsetY = THREE.MathUtils.clamp(spinOffset.y, -1, 1) * maxOffset;
  const rOffset = new THREE.Vector3()
    .addScaledVector(right, offsetX)
    .addScaledVector(UP, offsetY);

  const torqueImpulse = new THREE.Vector3().crossVectors(rOffset, impulse);
  applyAngularImpulse(cueBall, torqueImpulse);
};

const applyFriction = (ball: BallState, params: PhysicsParams, dt: number) => {
  const rContact = new THREE.Vector3(0, -ball.radius, 0);
  const vContact = toVec3(ball.velocity).add(new THREE.Vector3().crossVectors(ball.omega, rContact));
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
    const speed = ball.velocity.length();
    if (speed > 0) {
      const rollingForce = ball.velocity.clone().normalize().multiplyScalar(-params.muRoll * ball.mass * params.g);
      const rollingImpulse = rollingForce.multiplyScalar(dt);
      applyLinearImpulse(ball, new THREE.Vector3(rollingImpulse.x, 0, rollingImpulse.y));
    }
  }

  if (ball.velocity.length() < 0.002 && ball.omega.length() < 0.2) {
    ball.velocity.set(0, 0);
    ball.omega.multiplyScalar(0.5);
    if (ball.omega.length() < 0.05) {
      ball.omega.set(0, 0, 0);
    }
  }
};

const resolveBallBallCollision = (a: BallState, b: BallState, params: PhysicsParams) => {
  const delta = new THREE.Vector2().subVectors(b.position, a.position);
  const dist = delta.length();
  const minDist = a.radius + b.radius;
  if (dist >= minDist || dist <= 0) return;

  const normal = delta.clone().multiplyScalar(1 / dist);
  const penetration = minDist - dist;
  a.position.addScaledVector(normal, -penetration / 2);
  b.position.addScaledVector(normal, penetration / 2);

  const n3 = new THREE.Vector3(normal.x, 0, normal.y);
  const rA = n3.clone().multiplyScalar(a.radius);
  const rB = n3.clone().multiplyScalar(-b.radius);

  const vRel = toVec3(a.velocity)
    .add(new THREE.Vector3().crossVectors(a.omega, rA))
    .sub(toVec3(b.velocity).add(new THREE.Vector3().crossVectors(b.omega, rB)));

  const vn = vRel.dot(n3);
  if (vn >= 0) return;

  const invMassSum = 1 / a.mass + 1 / b.mass;
  const jn = (-(1 + params.restitution) * vn) / invMassSum;
  const impulseN = n3.clone().multiplyScalar(jn);

  applyLinearImpulse(a, impulseN.clone().multiplyScalar(-1));
  applyLinearImpulse(b, impulseN.clone().multiplyScalar(1));

  const vt = vRel.clone().sub(n3.clone().multiplyScalar(vn));
  const vtMag = vt.length();
  if (vtMag < 1e-6) return;

  const tDir = vt.multiplyScalar(1 / vtMag);
  let jt = -vtMag / invMassSum;
  const maxJt = params.muBall * jn;
  jt = THREE.MathUtils.clamp(jt, -maxJt, maxJt);
  const impulseT = tDir.clone().multiplyScalar(jt);

  applyLinearImpulse(a, impulseT.clone().multiplyScalar(-1));
  applyLinearImpulse(b, impulseT.clone().multiplyScalar(1));

  applyAngularImpulse(a, new THREE.Vector3().crossVectors(rA, impulseT).multiplyScalar(-1));
  applyAngularImpulse(b, new THREE.Vector3().crossVectors(rB, impulseT));
};

const resolveRailCollision = (ball: BallState, table: TableBounds, params: PhysicsParams) => {
  const { radius } = ball;
  const minX = table.minX + radius;
  const maxX = table.maxX - radius;
  const minZ = table.minZ + radius;
  const maxZ = table.maxZ - radius;

  const v3 = toVec3(ball.velocity);

  const collisions: Array<{ normal: THREE.Vector3; position: THREE.Vector2 }> = [];

  if (ball.position.x < minX) {
    ball.position.x = minX;
    collisions.push({ normal: new THREE.Vector3(1, 0, 0), position: ball.position });
  } else if (ball.position.x > maxX) {
    ball.position.x = maxX;
    collisions.push({ normal: new THREE.Vector3(-1, 0, 0), position: ball.position });
  }

  if (ball.position.y < minZ) {
    ball.position.y = minZ;
    collisions.push({ normal: new THREE.Vector3(0, 0, 1), position: ball.position });
  } else if (ball.position.y > maxZ) {
    ball.position.y = maxZ;
    collisions.push({ normal: new THREE.Vector3(0, 0, -1), position: ball.position });
  }

  for (const { normal } of collisions) {
    const rContact = normal.clone().multiplyScalar(radius);
    const vContact = v3.clone().add(new THREE.Vector3().crossVectors(ball.omega, rContact));
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
  }
};

export const stepPhysics = (
  state: PhysicsState,
  dt: number,
  table: TableBounds = DEFAULT_TABLE
) => {
  state.balls.forEach((ball) => applyFriction(ball, state.params, dt));

  state.balls.forEach((ball) => {
    ball.position.addScaledVector(ball.velocity, dt);
    resolveRailCollision(ball, table, state.params);
  });

  for (let i = 0; i < state.balls.length; i += 1) {
    for (let j = i + 1; j < state.balls.length; j += 1) {
      resolveBallBallCollision(state.balls[i], state.balls[j], state.params);
    }
  }
};

export const resetState = (state: PhysicsState) => {
  const fresh = createInitialState(state.params);
  state.balls = fresh.balls;
};
