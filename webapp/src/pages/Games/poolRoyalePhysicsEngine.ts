import * as THREE from 'three';

export type PoolPhysicsParams = {
  muK: number;
  muRoll: number;
  muBall: number;
  muRail: number;
  restitution: number;
  eps: number;
  g: number;
  maxSpinOffset: number;
};

export type PoolBall = {
  id: string;
  pos: THREE.Vector2;
  vel: THREE.Vector2;
  omega: THREE.Vector3;
  radius: number;
  mass: number;
  inertia: number;
  active: boolean;
};

export const DEFAULT_POOL_PARAMS: PoolPhysicsParams = {
  muK: 0.2,
  muRoll: 0.015,
  muBall: 0.2,
  muRail: 0.25,
  restitution: 0.92,
  eps: 0.02,
  g: 9.81,
  maxSpinOffset: 0.7
};

const UP = new THREE.Vector3(0, 1, 0);

const toVec3 = (v: THREE.Vector2) => new THREE.Vector3(v.x, 0, v.y);

const applyLinearImpulse = (ball: PoolBall, impulse: THREE.Vector3) => {
  ball.vel.x += impulse.x / ball.mass;
  ball.vel.y += impulse.z / ball.mass;
};

const applyAngularImpulse = (ball: PoolBall, impulse: THREE.Vector3) => {
  ball.omega.addScaledVector(impulse, 1 / ball.inertia);
};

export const strikeCueBall = (
  ball: PoolBall,
  direction: THREE.Vector2,
  power: number,
  spinOffset: { x: number; y: number },
  params: PoolPhysicsParams,
  maxImpulse: number
) => {
  const dir3 = toVec3(direction).normalize();
  if (!Number.isFinite(dir3.lengthSq()) || dir3.lengthSq() < 1e-6) return;

  const clampedPower = THREE.MathUtils.clamp(power, 0, 1);
  const impulse = dir3.multiplyScalar(maxImpulse * clampedPower);
  applyLinearImpulse(ball, impulse);

  const right = new THREE.Vector3(-dir3.z, 0, dir3.x).normalize();
  const maxOffset = params.maxSpinOffset * ball.radius;
  const offsetX = THREE.MathUtils.clamp(spinOffset.x, -1, 1) * maxOffset;
  const offsetY = THREE.MathUtils.clamp(spinOffset.y, -1, 1) * maxOffset;
  const rOffset = new THREE.Vector3()
    .addScaledVector(right, offsetX)
    .addScaledVector(UP, offsetY);

  const torqueImpulse = new THREE.Vector3().crossVectors(rOffset, impulse);
  applyAngularImpulse(ball, torqueImpulse);
};

export const applyTableFriction = (ball: PoolBall, params: PoolPhysicsParams, dt: number) => {
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

  if (ball.vel.length() < 0.002 && ball.omega.length() < 0.2) {
    ball.vel.set(0, 0);
    ball.omega.multiplyScalar(0.5);
    if (ball.omega.length() < 0.05) {
      ball.omega.set(0, 0, 0);
    }
  }
};

export const resolveBallBallCollision = (
  a: PoolBall,
  b: PoolBall,
  params: PoolPhysicsParams
) => {
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
  const jn = (-(1 + params.restitution) * vn) / invMassSum;
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

  return { normal, impulse: Math.abs(jn) };
};

export const applyRailImpulse = (
  ball: PoolBall,
  normal: THREE.Vector2,
  params: PoolPhysicsParams
) => {
  const n3 = new THREE.Vector3(normal.x, 0, normal.y).normalize();
  const rContact = n3.clone().multiplyScalar(ball.radius);
  const vContact = toVec3(ball.vel).add(new THREE.Vector3().crossVectors(ball.omega, rContact));
  const vn = vContact.dot(n3);
  if (vn >= 0) return null;

  const jn = -(1 + params.restitution) * vn * ball.mass;
  const impulseN = n3.clone().multiplyScalar(jn);
  applyLinearImpulse(ball, impulseN);

  const vt = vContact.clone().sub(n3.clone().multiplyScalar(vn));
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

  return { impulse: Math.abs(jn) };
};

export const stepPoolRoyalePhysics = (
  balls: PoolBall[],
  dt: number,
  params: PoolPhysicsParams
) => {
  balls.forEach((ball) => {
    if (!ball.active) return;
    applyTableFriction(ball, params, dt);
  });

  balls.forEach((ball) => {
    if (!ball.active) return;
    ball.pos.addScaledVector(ball.vel, dt);
  });

  const collisions: Array<{ a: PoolBall; b: PoolBall; impulse: number }> = [];
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      if (!a.active || !b.active) continue;
      const result = resolveBallBallCollision(a, b, params);
      if (result) {
        collisions.push({ a, b, impulse: result.impulse });
      }
    }
  }

  return { collisions };
};
