import { circuitDistance, sampleCircuitDistance } from './circuitMetrics.mjs';
import { kartBodyWidth } from './racingDimensions.mjs';
import { nearestPoint, wrapAngle } from './simulation.mjs';
import type { Input, Racer, Track } from './simulation.mjs';

export const CONVOY_TIME_LIMIT = 100;
const WAVES = [
  ['defender', 'brabus-g'],
  ['defender', 'brabus-g', 'defender'],
  ['defender', 'shota', 'brabus-g']
] as const;

type Point = { x: number; z: number };
type EnemyModel = typeof WAVES[number][number];
type ProjectileKind = 'gun' | 'rocket' | 'hostile';

export type ConvoyEnemy = Point & {
  id: number;
  model: EnemyModel;
  yaw: number;
  distance: number;
  lane: number;
  health: number;
  maxHealth: number;
  radius: number;
  attack: number;
  ramCooldown: number;
};

export type ConvoyProjectile = Point & {
  kind: ProjectileKind;
  vx: number;
  vz: number;
  life: number;
};

export type ConvoyBurst = Point & { age: number; large: boolean };
type PickupKind = 'boost' | 'rocket' | 'repair';
export type ConvoyPickup = Point & { kind: PickupKind; life: number };
export type ConvoyStatus = 'active' | 'cleared' | 'wrecked' | 'escaped' | 'timeout';
export type ConvoySummary = {
  wave: number;
  totalWaves: number;
  destroyed: number;
  hull: number;
  rockets: number;
  warning: boolean;
  shots: number;
  launches: number;
  blasts: number;
  hits: number;
  seconds: number;
  status: ConvoyStatus;
};

function segmentHit(start: Point, end: Point, target: Point, radius: number) {
  const dx = end.x - start.x, dz = end.z - start.z;
  const tx = target.x - start.x, tz = target.z - start.z;
  const t = Math.max(0, Math.min(1, (tx * dx + tz * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(tx - dx * t, tz - dz * t) <= radius ? t : Infinity;
}

export class ConvoyRun {
  readonly enemies: ConvoyEnemy[] = [];
  readonly projectiles: ConvoyProjectile[] = [];
  readonly bursts: ConvoyBurst[] = [];
  readonly pickups: ConvoyPickup[] = [];
  private wave = 0;
  private nextWave = 1.1;
  private elapsed = 0;
  private hull = 100;
  private destroyed = 0;
  private rockets = 2;
  private gunCooldown = 0;
  private rocketCooldown = 0;
  private shots = 0;
  private launches = 0;
  private blasts = 0;
  private hits = 0;
  private nextEnemyId = 0;
  private commandDestroyed = false;
  status: ConvoyStatus = 'active';

  constructor(private readonly track: Track) {}

  summary(): ConvoySummary {
    return {
      wave: this.wave,
      totalWaves: WAVES.length,
      destroyed: this.destroyed,
      hull: this.hull,
      rockets: this.rockets,
      warning: this.enemies.some(enemy => enemy.attack > 0 && enemy.attack <= .85),
      shots: this.shots,
      launches: this.launches,
      blasts: this.blasts,
      hits: this.hits,
      seconds: Math.max(0, Math.ceil(CONVOY_TIME_LIMIT - this.elapsed)),
      status: this.status
    };
  }

  step(player: Racer, input: Input, dt: number) {
    if (this.status !== 'active') return;
    this.elapsed += dt;
    this.gunCooldown -= dt;
    this.rocketCooldown -= dt;
    const near = nearestPoint(this.track, player.x, player.z, player.index);
    const distance = circuitDistance(this.track, near);

    if (!this.enemies.length && this.wave < WAVES.length) {
      this.nextWave -= dt;
      if (this.nextWave <= 0) this.spawnWave(distance);
    }

    for (const enemy of this.enemies) this.moveEnemy(enemy, player, dt);

    const target = this.targetAhead(player);
    if (target && this.gunCooldown <= 0) {
      this.shoot(player, target, 'gun', 90);
      this.gunCooldown = .17;
      this.shots++;
    }
    if (input.fire && this.rockets > 0 && this.rocketCooldown <= 0) {
      this.shoot(player, target || {
        x: player.x + Math.sin(player.yaw) * 30,
        z: player.z + Math.cos(player.yaw) * 30
      }, 'rocket', 62);
      this.rockets--;
      this.launches++;
      this.rocketCooldown = .65;
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i];
      const end = { x: shot.x + shot.vx * dt, z: shot.z + shot.vz * dt };
      let hit = false;
      if (shot.kind === 'hostile') {
        hit = (player.jumpHeight || 0) < 1 && segmentHit(shot, end, player, kartBodyWidth(player.kartId) * .57) < Infinity;
        if (hit) this.damagePlayer(12, player);
      } else {
        let target: ConvoyEnemy | undefined;
        let closest = Infinity;
        for (const enemy of this.enemies) {
          if (enemy.health <= 0) continue;
          const t = segmentHit(shot, end, enemy, enemy.radius);
          if (t < closest) {
            closest = t;
            target = enemy;
          }
        }
        if (target) {
          hit = true;
          this.bursts.push({ x: target.x, z: target.z, age: 0, large: shot.kind === 'rocket' });
          if (shot.kind === 'rocket') {
            this.blasts++;
            for (const enemy of this.enemies) {
              if (Math.hypot(enemy.x - target.x, enemy.z - target.z) < 5) enemy.health -= 90;
            }
          } else {
            target.health -= 7;
          }
        }
      }
      shot.life -= dt;
      if (hit || shot.life <= 0) this.projectiles.splice(i, 1);
      else Object.assign(shot, end);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.health <= 0) {
        this.bursts.push({ x: enemy.x, z: enemy.z, age: 0, large: true });
        this.blasts++;
        this.destroyed++;
        if (enemy.model === 'shota') this.commandDestroyed = true;
        const kind: PickupKind = enemy.model === 'brabus-g' ? 'rocket' : enemy.model === 'shota' ? 'repair' : 'boost';
        this.pickups.push({ x: enemy.x, z: enemy.z, kind, life: 12 });
      } else {
        const length = this.track.length;
        const signedGap = (enemy.distance - distance + 1.5 * length) % length - .5 * length;
        if (signedGap > -12) continue;
        if (enemy.model === 'shota') this.status = 'escaped';
      }
      this.enemies.splice(i, 1);
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.life -= dt;
      if (pickup.life <= 0) this.pickups.splice(i, 1);
      else if (Math.hypot(pickup.x - player.x, pickup.z - player.z) < 1.5 && (player.jumpHeight || 0) < 1.2) {
        if (pickup.kind === 'rocket') this.rockets = Math.min(5, this.rockets + 1);
        if (pickup.kind === 'repair') this.hull = Math.min(100, this.hull + 30);
        if (pickup.kind === 'boost') {
          player.boost = Math.min(100, player.boost + 40);
          player.boostEvent++;
        }
        this.pickups.splice(i, 1);
      }
    }
    this.advanceEffects(dt);
    if (this.hull <= 0) this.status = 'wrecked';
    else if (!this.enemies.length && this.commandDestroyed) this.status = 'cleared';
    else if (this.elapsed >= CONVOY_TIME_LIMIT && this.status === 'active') this.status = 'timeout';
  }

  advanceEffects(dt: number) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += dt;
      if (burst.age > (burst.large ? 1.35 : .19)) this.bursts.splice(i, 1);
    }
  }

  private spawnWave(distance: number) {
    const wave = WAVES[this.wave++];
    this.nextWave = 2;
    wave.forEach((model, index) => {
      const health = model === 'shota' ? 140 : model === 'brabus-g' ? 50 : 35;
      const enemy: ConvoyEnemy = {
        id: this.nextEnemyId++, model, x: 0, z: 0, yaw: 0,
        distance: distance + 35 + index * 9,
        lane: (index === 1 ? 0 : index === 2 ? 1 : -1),
        health, maxHealth: health, radius: model === 'shota' ? 1.55 : 1.08,
        attack: 3.1 + index * 1.6, ramCooldown: 0
      };
      this.placeEnemy(enemy);
      this.enemies.push(enemy);
    });
  }

  private placeEnemy(enemy: ConvoyEnemy) {
    const p = sampleCircuitDistance(this.track, enemy.distance);
    const width = this.track.points[p.index].width ?? this.track.width;
    const offset = Math.max(0, Math.min(width * .25, width * .5 - enemy.radius - .15)) * enemy.lane;
    enemy.x = p.x - Math.cos(p.yaw) * offset;
    enemy.z = p.z + Math.sin(p.yaw) * offset;
    enemy.yaw = p.yaw;
  }

  private moveEnemy(enemy: ConvoyEnemy, player: Racer, dt: number) {
    enemy.distance = (enemy.distance + (enemy.model === 'shota' ? 16 : 12) * dt) % this.track.length;
    this.placeEnemy(enemy);
    enemy.ramCooldown -= dt;
    const gap = Math.hypot(enemy.x - player.x, enemy.z - player.z);
    if (gap < enemy.radius + kartBodyWidth(player.kartId) / 2 && (player.jumpHeight || 0) < 1.1 && enemy.ramCooldown <= 0) {
      enemy.ramCooldown = 1.4;
      player.speed *= .6;
      this.damagePlayer(17, player);
      this.bursts.push({ x: player.x, z: player.z, age: 0, large: false });
    }
    const direction = Math.atan2(enemy.x - player.x, enemy.z - player.z);
    if (gap < 6 || gap > 46 || Math.abs(wrapAngle(direction - player.yaw)) > 1.3) {
      enemy.attack = Math.max(1.1, enemy.attack);
      return;
    }
    enemy.attack -= dt;
    if (enemy.attack <= 0) {
      this.shoot(enemy, {
        x: player.x + Math.sin(player.velocityYaw) * player.speed * .16,
        z: player.z + Math.cos(player.velocityYaw) * player.speed * .16
      }, 'hostile', 36);
      enemy.attack = enemy.model === 'shota' ? 2.1 : 3.7;
    }
  }

  private targetAhead(player: Racer) {
    let closest = 43;
    let target: ConvoyEnemy | undefined;
    for (const enemy of this.enemies) {
      const dx = enemy.x - player.x, dz = enemy.z - player.z;
      const gap = Math.hypot(dx, dz);
      if (gap < 2.2 || gap >= closest || Math.abs(wrapAngle(Math.atan2(dx, dz) - player.yaw)) > .19) continue;
      closest = gap;
      target = enemy;
    }
    return target;
  }

  private shoot(origin: Point, target: Point, kind: ProjectileKind, speed: number) {
    const angle = Math.atan2(target.x - origin.x, target.z - origin.z);
    const x = Math.sin(angle), z = Math.cos(angle);
    this.projectiles.push({
      x: origin.x + x * 1.15, z: origin.z + z * 1.15, vx: x * speed, vz: z * speed,
      kind, life: kind === 'rocket' ? 1.2 : .95
    });
  }

  private damagePlayer(amount: number, player: Racer) {
    if (this.hull <= 0) return;
    this.hits++;
    this.hull = Math.max(0, this.hull - amount);
    if (this.hull <= 0) {
      player.speed = 0;
      player.boosting = false;
      this.bursts.push({ x: player.x, z: player.z, age: 0, large: true });
      this.blasts++;
    }
  }
}
