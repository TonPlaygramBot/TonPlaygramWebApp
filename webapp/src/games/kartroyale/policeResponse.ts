import * as T from 'three';
import type { Track, Racer } from './simulation.mjs';
import { cloneHuman, bakeHuman, poseHuman, type Human } from './supporterHuman';
import { occupied } from './tiranaScenery';
import {
  createWaterState,
  updateWater,
  waterPoint,
  type ThrowEvent
} from './protestResponse.mjs';

/** Roadside police observe throwing, then a bounded water jet disperses throwers
 * at the Parliament entrance. This scene never changes race simulation state. */
export class PoliceResponse {
  readonly group = new T.Group();
  private positions: { x: number; z: number; yaw: number }[] = [];
  private batches: T.InstancedMesh[] = [];
  private officers: Human[] = [];
  private truck: T.Group;
  private turret?: T.Object3D;
  private nozzle?: T.Object3D;
  private transform = new T.Object3D();
  private state = createWaterState();
  private water: T.Mesh;
  private spray: T.InstancedMesh;
  private sprayed = -1;
  private officerMist: T.InstancedMesh;
  private observed = new Set<number>();
  constructor(track: Track, police: T.Group, truck: T.Group) {
    const stride = Math.max(
      1,
      Math.round(7 / (track.length / (track.points.length - 1)))
    );
    for (let i = 4; i < track.points.length - 1; i += stride)
      for (const side of [-1, 1]) {
        const p = track.points[i],
          offset = track.width / 2 + 1.3;
        const x = p.x - Math.cos(p.yaw) * offset * side,
          z = p.z + Math.sin(p.yaw) * offset * side;
        if (!occupied(x, z))
          this.positions.push({
            x,
            z,
            yaw: p.yaw + (side < 0 ? -Math.PI / 2 : Math.PI / 2)
          });
      }
    const baked = cloneHuman(police);
    this.batches = bakeHuman(baked).map(({ geometry, material }) => {
      const mesh = new T.InstancedMesh(geometry, material, 180);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.group.add(mesh);
      return mesh;
    });
    baked.root.traverse((o) => {
      if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
    });
    this.officers = Array.from({ length: 6 }, () => {
      const h = cloneHuman(police);
      this.group.add(h.root);
      return h;
    });
    this.truck = truck.clone(true);
    const p = track.points.at(-1)!;
    // Pavement beside the public forecourt. The route/finish stays clear.
    this.truck.position.set(
      p.x - Math.cos(p.yaw) * 9,
      0.14,
      p.z + Math.sin(p.yaw) * 9
    );
    this.truck.rotation.y = p.yaw;
    this.truck.name = 'Parliament police water cannon';
    this.group.add(this.truck);
    this.turret = this.truck.getObjectByName('turret');
    this.nozzle = this.truck.getObjectByName('nozzle');
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array(33 * 2 * 3), 3)
    );
    const indices = [];
    for (let i = 0; i < 32; i++)
      indices.push(
        i * 2,
        i * 2 + 1,
        i * 2 + 2,
        i * 2 + 1,
        i * 2 + 3,
        i * 2 + 2
      );
    geometry.setIndex(indices);
    this.water = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        color: '#d1efff',
        transparent: true,
        opacity: 0.66,
        side: T.DoubleSide,
        depthWrite: false
      })
    );
    this.water.frustumCulled = false;
    this.water.visible = false;
    this.group.add(this.water);
    this.officerMist = new T.InstancedMesh(
      new T.SphereGeometry(0.025, 5, 3),
      new T.MeshBasicMaterial({
        color: '#dfd8b8',
        transparent: true,
        opacity: 0.3,
        depthWrite: false
      }),
      48
    );
    this.officerMist.frustumCulled = false;
    this.officerMist.count = 0;
    this.group.add(this.officerMist);
    this.spray = new T.InstancedMesh(
      new T.SphereGeometry(0.035, 5, 3),
      new T.MeshBasicMaterial({
        color: '#e1f6ff',
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      }),
      96
    );
    this.spray.frustumCulled = false;
    this.spray.count = 0;
    this.group.add(this.spray);
  }
  update(
    time: number,
    me: Racer,
    events: ThrowEvent[],
    running: boolean,
    performance: boolean,
    wet: (seed: number, time: number) => void
  ) {
    const visible = this.positions
      .filter(
        (p) => Math.hypot(p.x - me.x, p.z - me.z) < (performance ? 65 : 95)
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - me.x, a.z - me.z) -
          Math.hypot(b.x - me.x, b.z - me.z)
      )
      .slice(0, 180);
    let count = 0,
      mistCount = 0;
    const animated = performance ? 2 : 6;
    for (let i = 0; i < visible.length; i++) {
      const p = visible[i],
        m = this.transform;
      m.position.set(p.x, 0.19, p.z);
      m.rotation.set(0, p.yaw, 0);
      m.scale.setScalar(1);
      m.updateMatrix();
      if (i < animated) {
        const h = this.officers[i];
        h.root.visible = true;
        h.root.position.copy(m.position);
        const event = events.find(
          (e) => time - e.time < 3.5 && Math.hypot(e.x - p.x, e.z - p.z) < 22
        );
        h.root.rotation.y = event
          ? Math.atan2(event.x - p.x, event.z - p.z)
          : p.yaw;
        poseHuman(h, time + i, -1, !!event);
        if (
          event &&
          time - event.time > 0.5 &&
          time - event.time < 1.6 &&
          Math.hypot(event.x - p.x, event.z - p.z) < 4.5 &&
          mistCount === 0
        ) {
          const origin =
            h.bones.get('hand_l')?.[0]?.getWorldPosition(new T.Vector3()) ||
            h.root.position.clone().add(new T.Vector3(0, 1.4, 0));
          for (let j = 0; j < 48; j++) {
            const t = (j / 48 + time * 3) % 1,
              a = j * 2.399;
            m.position.set(
              origin.x + (event.x - origin.x) * t + Math.cos(a) * t * 0.18,
              origin.y + (1.3 - origin.y) * t + Math.sin(a) * t * 0.18,
              origin.z + (event.z - origin.z) * t
            );
            m.scale.setScalar(0.4 + t * 1.8);
            m.updateMatrix();
            this.officerMist.setMatrixAt(mistCount++, m.matrix);
          }
          if (!this.observed.has(event.id)) {
            wet(event.seed, time);
            this.observed.add(event.id);
            if (this.observed.size > 32)
              this.observed.delete(this.observed.values().next().value!);
          }
        }
      } else
        (this.batches.forEach((b) => b.setMatrixAt(count, m.matrix)), count++);
    }
    this.officerMist.count = mistCount;
    this.officerMist.instanceMatrix.needsUpdate = true;
    this.officers.forEach((h, i) => {
      h.root.visible = i < Math.min(animated, visible.length);
    });
    this.batches.forEach((b) => {
      b.count = count;
      b.instanceMatrix.needsUpdate = true;
    });
    this.truck.visible =
      Math.hypot(this.truck.position.x - me.x, this.truck.position.z - me.z) <
      180;
    updateWater(this.state, events, this.truck.position, time, running);
    const target = this.state.target;
    this.water.visible = !!target && this.truck.visible;
    this.spray.count = 0;
    if (!this.water.visible || !target) return;
    if (this.sprayed !== this.state.lastEvent) {
      wet(target.seed, time);
      this.sprayed = this.state.lastEvent;
    }
    if (this.turret) {
      const local = this.truck.worldToLocal(
        new T.Vector3(target.x, target.y, target.z)
      );
      this.turret.rotation.y = Math.atan2(
        local.x - this.turret.position.x,
        local.z - this.turret.position.z
      );
    }
    this.truck.updateMatrixWorld(true);
    const origin =
      this.nozzle?.getWorldPosition(new T.Vector3()) ||
      this.truck.position.clone().add(new T.Vector3(0, 3, 0));
    const direction = new T.Vector3(
      target.x - origin.x,
      0,
      target.z - origin.z
    ).normalize();
    const side = new T.Vector3(-direction.z, 0, direction.x);
    const pos = this.water.geometry.getAttribute(
      'position'
    ) as T.BufferAttribute;
    for (let i = 0; i <= 32; i++) {
      const p = waterPoint(origin, target, i / 32, time),
        radius = 0.045 + (i / 32) * 0.1;
      for (let s = 0; s < 2; s++)
        pos.setXYZ(
          i * 2 + s,
          p.x + side.x * radius * (s * 2 - 1),
          p.y,
          p.z + side.z * radius * (s * 2 - 1)
        );
    }
    pos.needsUpdate = true;
    for (let i = 0; i < 96; i++) {
      const t = (i / 96 + time * 1.6) % 1,
        m = this.transform,
        p = waterPoint(origin, target, t, time),
        a = i * 2.399;
      m.position.set(
        p.x + Math.cos(a) * 0.25 * t,
        p.y + Math.sin(a + time * 8) * 0.16 * t,
        p.z + Math.sin(a) * 0.25 * t
      );
      if (i > 63) {
        const age = (i / 32 + time * 2) % 1;
        m.position.set(
          target.x + Math.cos(a) * age * 1.4,
          target.y + age * 0.7 - age * age * 1.5,
          target.z + Math.sin(a) * age * 1.4
        );
      }
      m.scale.setScalar(0.8 + (i % 5) * 0.28);
      m.rotation.set(0, 0, 0);
      m.updateMatrix();
      this.spray.setMatrixAt(i, m.matrix);
    }
    this.spray.count = 96;
    this.spray.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.group.removeFromParent();
    this.batches.forEach((b) => {
      b.geometry.dispose();
      b.dispose();
    });
    this.officers.forEach((h) =>
      h.root.traverse((o) => {
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      })
    );
    this.officerMist.geometry.dispose();
    (this.officerMist.material as T.Material).dispose();
    this.officerMist.dispose();
    this.water.geometry.dispose();
    (this.water.material as T.Material).dispose();
    this.spray.geometry.dispose();
    (this.spray.material as T.Material).dispose();
    this.spray.dispose();
  }
}
