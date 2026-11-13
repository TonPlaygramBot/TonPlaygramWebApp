import * as T from 'three';
import type { ConvoyRun, ConvoyEnemy } from './ConvoyRun';
import { surfaceHeight } from './racingSurface.mjs';
import type { Track } from './simulation.mjs';

export class ConvoyVisuals {
  readonly group = new T.Group();
  private readonly vehicles = new Map<number, { group: T.Group; health: T.Mesh }>();
  private readonly projectileBatch = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ toneMapped: false }), 64);
  private readonly effectBatch = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0), new T.MeshBasicMaterial({ toneMapped: false }), 96);
  private readonly pickupBatch = new T.InstancedMesh(new T.OctahedronGeometry(.46), new T.MeshStandardMaterial({ emissive: '#27313f', roughness: .35 }), 24);
  private readonly healthGeometry = new T.PlaneGeometry(1.9, .11);
  private readonly healthMaterial = new T.MeshBasicMaterial({ color: '#ff6651', side: T.DoubleSide });
  private readonly transform = new T.Object3D();
  private readonly color = new T.Color();

  constructor(private readonly track: Track, private readonly models: Map<string, T.Group>) {
    for (const batch of [this.projectileBatch, this.effectBatch, this.pickupBatch]) {
      batch.frustumCulled = false;
      batch.instanceMatrix.setUsage(T.DynamicDrawUsage);
      batch.count = 0;
      this.group.add(batch);
    }
  }

  update(run: ConvoyRun, camera: T.PerspectiveCamera, time: number) {
    for (const [id, visual] of this.vehicles) {
      if (run.enemies.some(enemy => enemy.id === id)) continue;
      visual.group.removeFromParent();
      this.vehicles.delete(id);
    }
    for (const enemy of run.enemies) {
      const visual = this.vehicles.get(enemy.id) ?? this.addEnemy(enemy);
      visual.group.position.set(enemy.x, this.height(enemy.x, enemy.z), enemy.z);
      visual.group.rotation.y = enemy.yaw;
      visual.health.quaternion.setFromAxisAngle(T.Object3D.DEFAULT_UP, -enemy.yaw).multiply(camera.quaternion);
      visual.health.scale.x = Math.max(0, enemy.health / enemy.maxHealth);
      visual.health.visible = enemy.health < enemy.maxHealth || enemy.model === 'shota';
    }

    const shots = this.projectileBatch;
    shots.count = 0;
    for (const p of run.projectiles) {
      if (shots.count === shots.instanceMatrix.count) break;
      const rocket = p.kind === 'rocket';
      this.put(shots, p.x, this.height(p.x, p.z) + .73, p.z,
        rocket ? '#71e8ff' : p.kind === 'hostile' ? '#ff603b' : '#fff2a4',
        rocket ? .24 : .075, rocket ? .24 : .075, rocket ? 2.5 : 1.2, Math.atan2(p.vx, p.vz));
    }
    const effects = this.effectBatch;
    effects.count = 0;
    for (const burst of run.bursts) {
      const ground = this.height(burst.x, burst.z);
      const count = burst.large ? 9 : 3;
      for (let i = 0; i < count && effects.count < effects.instanceMatrix.count; i++) {
        const angle = i * Math.PI * 2 / count;
        const radius = burst.age * (burst.large ? 2.8 : 6);
        const fire = burst.age < .29;
        const size = burst.large ? (fire ? .62 + burst.age * 1.3 : .83 * (1.4 - burst.age)) : .16;
        this.put(effects, burst.x + Math.cos(angle) * radius,
          ground + .7 + burst.age * (burst.large ? 2.2 + i % 3 : 3),
          burst.z + Math.sin(angle) * radius,
          fire ? (i % 2 ? '#ff8826' : '#ffe283') : '#27292a', size, size, size, angle);
      }
    }
    const pickups = this.pickupBatch;
    pickups.count = 0;
    for (const p of run.pickups) {
      if (pickups.count === pickups.instanceMatrix.count) break;
      this.put(pickups, p.x, this.height(p.x, p.z) + .75 + Math.sin(time * 5) * .14, p.z,
        p.kind === 'rocket' ? '#66e5ff' : p.kind === 'repair' ? '#9cf65e' : '#ffcc57', 1, 1, 1, time * 3);
    }
    for (const batch of [shots, effects, pickups]) {
      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
    }
  }

  private addEnemy(enemy: ConvoyEnemy) {
    const group = new T.Group();
    group.add(this.models.get(enemy.model)!.clone(true));
    const health = new T.Mesh(this.healthGeometry, this.healthMaterial);
    health.position.y = enemy.model === 'shota' ? 3.5 : 2.5;
    group.add(health);
    this.group.add(group);
    const visual = { group, health };
    this.vehicles.set(enemy.id, visual);
    return visual;
  }

  private height(x: number, z: number) {
    return .14 + surfaceHeight(this.track, x, z);
  }

  private put(batch: T.InstancedMesh, x: number, y: number, z: number,
    color: string, sx: number, sy: number, sz: number, yaw: number) {
    this.transform.position.set(x, y, z);
    this.transform.rotation.y = yaw;
    this.transform.scale.set(sx, sy, sz);
    this.transform.updateMatrix();
    batch.setMatrixAt(batch.count, this.transform.matrix);
    batch.setColorAt(batch.count++, this.color.set(color));
  }

  dispose() {
    this.group.removeFromParent();
    this.vehicles.clear();
    for (const batch of [this.projectileBatch, this.effectBatch, this.pickupBatch]) {
      batch.geometry.dispose();
      batch.material.dispose();
      batch.dispose();
    }
    this.healthGeometry.dispose();
    this.healthMaterial.dispose();
    this.group.clear();
  }
}
