import * as THREE from 'three';

export type PoolPhysicsParams = {
  muK: number;
  muRoll: number;
  muBall: number;
  muRail: number;
  restitutionBall: number;
  restitutionRail: number;
  eps: number;
  g: number;
  maxSpinOffset: number;
  maxCueImpulse: number;
};

export const DEFAULT_POOL_PHYSICS_PARAMS: PoolPhysicsParams = {
  muK: 0.2,
  muRoll: 0.015,
  muBall: 0.2,
  muRail: 0.25,
  restitutionBall: 0.92,
  restitutionRail: 0.985,
  eps: 0.02,
  g: 9.81,
  maxSpinOffset: 0.7,
  maxCueImpulse: 2.8
};

type BallLike = {
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  omega?: THREE.Vector3;
  mass?: number;
  radius?: number;
  inertia?: number;
  lift?: number;
};

const UP = new THREE.Vector3(0, 1, 0);

const toVec3 = (v: THREE.Vector2) => new THREE.Vector3(v.x, 0, v.y);

const applyLinearImpulse = (ball: BallLike, impulse: THREE.Vector3) => {
  if (!ball.mass) return;
  ball.vel.x += impulse.x / ball.mass;
  ball.vel.y += impulse.z / ball.mass;
};

const applyAngularImpulse = (ball: BallLike, impulse: THREE.Vector3) => {
  if (!ball.omega || !ball.inertia) return;
  ball.omega.addScaledVector(impulse, 1 / ball.inertia);
};

export const ensureBallPhysics = (ball: BallLike, radius: number, mass: number) => {
  if (!ball.omega) ball.omega = new THREE.Vector3();
  if (!ball.radius) ball.radius = radius;
  if (!ball.mass) ball.mass = mass;
  if (!ball.inertia) ball.inertia = 0.4 * mass * radius * radius;
};

export const strikeCueBall = (
  cueBall: BallLike,
  direction: THREE.Vector2,
  power: number,
  spinOffset: { x: number; y: number },
  params: PoolPhysicsParams
) => {
  if (!cueBall.radius || !cueBall.mass || !cueBall.inertia) return;
  if (!cueBall.omega) cueBall.omega = new THREE.Vector3();

  const dir3 = toVec3(direction).normalize();
  if (!Number.isFinite(dir3.lengthSq()) || dir3.lengthSq() < 1e-6) return;

  const clampedPower = Math.min(Math.max(power, 0), 1);
  const impulse = dir3.multiplyScalar(params.maxCueImpulse * clampedPower);
  applyLinearImpulse(cueBall, impulse);

  const right = new THREE.Vector3(-dir3.z, 0, dir3.x).normalize();
  const maxOffset = params.maxSpinOffset * cueBall.radius;
  const offsetX = THREE.MathUtils.clamp(spinOffset.x, -1, 1) * maxOffset;
  const offsetY = THREE.MathUtils.clamp(spinOffset.y, -1, 1) * maxOffset;
  const rOffset = new THREE.Vector3()
    .addScaledVector(right, offsetX)
    .addScaledVector(UP, offsetY);

  const torqueImpulse = new THREE.Vector3().crossVectors(rOffset, impulse);
  applyAngularImpulse(cueBall, torqueImpulse);
};

export const applyTableFriction = (ball: BallLike, params: PoolPhysicsParams, dt: number) => {
  if (!ball.radius || !ball.mass || !ball.omega) return;
  if ((ball.lift ?? 0) > 0) return;

  const rContact = new THREE.Vector3(0, -ball.radius, 0);
  const vContact = toVec3(ball.vel).add(new THREE.Vector3().crossVectors(ball.omega, rContact));
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
};

export const resolveBallBallCollision = (
  a: BallLike,
  b: BallLike,
  params: PoolPhysicsParams
) => {
  if (!a.radius || !b.radius || !a.mass || !b.mass || !a.omega || !b.omega) return null;
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

  const vRel = toVec3(a.vel)
    .add(new THREE.Vector3().crossVectors(a.omega, rA))
    .sub(toVec3(b.vel).add(new THREE.Vector3().crossVectors(b.omega, rB)));

  const vn = vRel.dot(n3);
  if (vn >= 0) return null;

  const invMassSum = 1 / a.mass + 1 / b.mass;
  const jn = (-(1 + params.restitutionBall) * vn) / invMassSum;
  const impulseN = n3.clone().multiplyScalar(jn);

  applyLinearImpulse(a, impulseN.clone().multiplyScalar(-1));
  applyLinearImpulse(b, impulseN.clone().multiplyScalar(1));

  const vt = vRel.clone().sub(n3.clone().multiplyScalar(vn));
  const vtMag = vt.length();
  if (vtMag > 1e-6) {
    const tDir = vt.multiplyScalar(1 / vtMag);
    let jt = -vtMag / invMassSum;
    const maxJt = params.muBall * jn;
    jt = THREE.MathUtils.clamp(jt, -maxJt, maxJt);
    const impulseT = tDir.clone().multiplyScalar(jt);

    applyLinearImpulse(a, impulseT.clone().multiplyScalar(-1));
    applyLinearImpulse(b, impulseT.clone().multiplyScalar(1));

    applyAngularImpulse(a, new THREE.Vector3().crossVectors(rA, impulseT).multiplyScalar(-1));
    applyAngularImpulse(b, new THREE.Vector3().crossVectors(rB, impulseT));
  }

  return { impulse: Math.abs(jn), normal };
};

export const applyRailImpulse = (ball: BallLike, normal2D: THREE.Vector2, params: PoolPhysicsParams) => {
  if (!ball.radius || !ball.mass || !ball.omega) return null;
  const normal = new THREE.Vector3(normal2D.x, 0, normal2D.y);
  const rContact = normal.clone().multiplyScalar(ball.radius);
  const vContact = toVec3(ball.vel).add(new THREE.Vector3().crossVectors(ball.omega, rContact));
  const vn = vContact.dot(normal);
  if (vn >= 0) return null;

  const jn = -(1 + params.restitutionRail) * vn * ball.mass;
  const impulseN = normal.clone().multiplyScalar(jn);
  const preImpactVel = ball.vel.clone();
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

  return { preImpactVel, normal: normal2D.clone() };
};
