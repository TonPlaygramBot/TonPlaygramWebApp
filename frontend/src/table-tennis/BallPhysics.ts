import * as THREE from 'three';
import { GAME_CONFIG, NET_BOUNDS, Side, TABLE_BOUNDS } from './gameConfig';

export type BallStateName =
  | 'idle'
  | 'serve'
  | 'flying'
  | 'tableBouncePlayer'
  | 'tableBounceAI'
  | 'paddleHitPlayer'
  | 'paddleHitAI'
  | 'netHit'
  | 'out'
  | 'pointEnded';

export interface BallSnapshot {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  state: BallStateName;
  bounces: Record<Side, number>;
  lastTouch: Side | null;
}

export interface BallEvent {
  type: 'bounce' | 'net' | 'out';
  side?: Side;
  position: THREE.Vector3;
  state: BallStateName;
}

const tmp = new THREE.Vector3();

export class BallPhysics {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly spin = new THREE.Vector3();
  state: BallStateName = 'idle';
  lastTouch: Side | null = null;
  bounces: Record<Side, number> = { player: 0, ai: 0 };
  private accumulator = 0;

  resetForServe(server: Side) {
    this.position.set(
      server === 'player' ? -GAME_CONFIG.table.width * 0.09 : GAME_CONFIG.table.width * 0.09,
      GAME_CONFIG.table.topY + GAME_CONFIG.serveHeight,
      server === 'player' ? GAME_CONFIG.table.length * 0.35 : -GAME_CONFIG.table.length * 0.35,
    );
    this.velocity.set(0, 0, 0);
    this.spin.set(0, 0, 0);
    this.lastTouch = server;
    this.bounces = { player: 0, ai: 0 };
    this.state = 'serve';
    this.accumulator = 0;
  }

  serve(server: Side) {
    this.resetBouncesAfterHit(server);
    this.velocity.set(server === 'player' ? 0.08 : -0.08, 1.25, server === 'player' ? -GAME_CONFIG.serveForwardPower : GAME_CONFIG.serveForwardPower);
    this.spin.set(server === 'player' ? 0.2 : -0.2, 0, server === 'player' ? -1.2 : 1.2);
    this.state = 'flying';
  }

  applyPaddleHit(side: Side, velocity: THREE.Vector3, spin: THREE.Vector3) {
    this.velocity.copy(velocity);
    this.spin.copy(spin);
    this.lastTouch = side;
    this.resetBouncesAfterHit(side);
    this.state = side === 'player' ? 'paddleHitPlayer' : 'paddleHitAI';
  }

  update(deltaSeconds: number): BallEvent[] {
    const events: BallEvent[] = [];
    this.accumulator += Math.min(deltaSeconds, 0.05);
    while (this.accumulator >= GAME_CONFIG.fixedDt) {
      events.push(...this.step(GAME_CONFIG.fixedDt));
      this.accumulator -= GAME_CONFIG.fixedDt;
    }
    return events;
  }

  private step(dt: number): BallEvent[] {
    if (this.state === 'idle' || this.state === 'serve' || this.state === 'pointEnded') return [];

    const events: BallEvent[] = [];
    const previous = this.position.clone();
    const acceleration = tmp.set(this.spin.z * GAME_CONFIG.spinCurve, GAME_CONFIG.gravity, -this.spin.x * GAME_CONFIG.spinCurve);
    this.velocity.addScaledVector(acceleration, dt);
    this.velocity.multiplyScalar(1 - GAME_CONFIG.drag * dt);
    this.position.addScaledVector(this.velocity, dt);

    const tableEvent = this.resolveTableCollision(previous);
    if (tableEvent) events.push(tableEvent);

    const netEvent = this.resolveNetCollision(previous);
    if (netEvent) events.push(netEvent);

    if (this.isClearlyOut()) {
      this.state = 'out';
      events.push({ type: 'out', position: this.position.clone(), state: this.state });
    } else if (this.state !== 'netHit' && this.state !== 'out') {
      this.state = 'flying';
    }

    return events;
  }

  private resolveTableCollision(previous: THREE.Vector3): BallEvent | null {
    const top = GAME_CONFIG.table.topY + GAME_CONFIG.ballRadius;
    const crossedTop = previous.y >= top && this.position.y <= top;
    if (!crossedTop || this.velocity.y >= 0) return null;

    const t = (previous.y - top) / Math.max(previous.y - this.position.y, 0.0001);
    const xAtImpact = THREE.MathUtils.lerp(previous.x, this.position.x, t);
    const zAtImpact = THREE.MathUtils.lerp(previous.z, this.position.z, t);
    const inside = xAtImpact >= TABLE_BOUNDS.minX && xAtImpact <= TABLE_BOUNDS.maxX && zAtImpact >= TABLE_BOUNDS.minZ && zAtImpact <= TABLE_BOUNDS.maxZ;
    if (!inside) return null;

    this.position.set(xAtImpact, top, zAtImpact);
    this.velocity.y = Math.abs(this.velocity.y) * 0.88;
    this.velocity.x += this.spin.z * 0.018;
    this.velocity.z -= this.spin.x * 0.018;
    this.spin.multiplyScalar(0.84);

    const side: Side = zAtImpact > 0 ? 'player' : 'ai';
    this.bounces[side] += 1;
    this.state = side === 'player' ? 'tableBouncePlayer' : 'tableBounceAI';
    return { type: 'bounce', side, position: this.position.clone(), state: this.state };
  }

  private resolveNetCollision(previous: THREE.Vector3): BallEvent | null {
    const radius = GAME_CONFIG.ballRadius;
    const crossesNet = (previous.z - NET_BOUNDS.minZ) * (this.position.z - NET_BOUNDS.minZ) <= 0 || (previous.z - NET_BOUNDS.maxZ) * (this.position.z - NET_BOUNDS.maxZ) <= 0;
    const insideX = this.position.x + radius >= NET_BOUNDS.minX && this.position.x - radius <= NET_BOUNDS.maxX;
    const insideY = this.position.y - radius <= NET_BOUNDS.maxY && this.position.y + radius >= NET_BOUNDS.minY;
    const insideZ = this.position.z + radius >= NET_BOUNDS.minZ && this.position.z - radius <= NET_BOUNDS.maxZ;
    if (!crossesNet || !insideX || !insideY || !insideZ) return null;

    this.position.z = previous.z > 0 ? NET_BOUNDS.maxZ + radius : NET_BOUNDS.minZ - radius;
    this.velocity.z *= -0.42;
    this.velocity.y = Math.max(this.velocity.y, 0.35);
    this.spin.multiplyScalar(0.55);
    this.state = 'netHit';
    return { type: 'net', position: this.position.clone(), state: this.state };
  }

  private isClearlyOut() {
    const margin = 0.44;
    return this.position.y < GAME_CONFIG.table.topY - 0.42 || Math.abs(this.position.x) > TABLE_BOUNDS.maxX + margin || Math.abs(this.position.z) > TABLE_BOUNDS.maxZ + 1.0;
  }

  private resetBouncesAfterHit(side: Side) {
    this.lastTouch = side;
    this.bounces = { player: 0, ai: 0 };
  }

  predictLandingPoint(targetSide?: Side): THREE.Vector3 | null {
    const simPos = this.position.clone();
    const simVel = this.velocity.clone();
    const simSpin = this.spin.clone();
    const top = GAME_CONFIG.table.topY + GAME_CONFIG.ballRadius;

    for (let i = 0; i < 240; i += 1) {
      const prev = simPos.clone();
      simVel.addScaledVector(new THREE.Vector3(simSpin.z * GAME_CONFIG.spinCurve, GAME_CONFIG.gravity, -simSpin.x * GAME_CONFIG.spinCurve), GAME_CONFIG.fixedDt);
      simVel.multiplyScalar(1 - GAME_CONFIG.drag * GAME_CONFIG.fixedDt);
      simPos.addScaledVector(simVel, GAME_CONFIG.fixedDt);
      if (prev.y >= top && simPos.y <= top && simVel.y < 0) {
        const t = (prev.y - top) / Math.max(prev.y - simPos.y, 0.0001);
        const x = THREE.MathUtils.lerp(prev.x, simPos.x, t);
        const z = THREE.MathUtils.lerp(prev.z, simPos.z, t);
        const side: Side = z > 0 ? 'player' : 'ai';
        if (x >= TABLE_BOUNDS.minX && x <= TABLE_BOUNDS.maxX && z >= TABLE_BOUNDS.minZ && z <= TABLE_BOUNDS.maxZ && (!targetSide || side === targetSide)) {
          return new THREE.Vector3(x, top, z);
        }
      }
    }
    return null;
  }

  snapshot(): BallSnapshot {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      spin: this.spin.clone(),
      state: this.state,
      bounces: { ...this.bounces },
      lastTouch: this.lastTouch,
    };
  }
}
