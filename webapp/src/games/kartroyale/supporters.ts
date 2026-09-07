import * as T from 'three';
import type { Track, Racer } from './simulation.mjs';
import type { FoodKind, Point3 } from './foodFlight.mjs';
import type { ThrowEvent } from './protestResponse.mjs';
import { randomUnit } from './foodFlight.mjs';
import { occupied } from './tiranaScenery';
import { cloneHuman, bakeHuman, poseHuman, type Human } from './supporterHuman';

type Fan = {
  x: number;
  z: number;
  yaw: number;
  seed: number;
  flag: boolean;
  scale: number;
  variant: number;
  nextThrow: number;
  wetUntil: number;
};
type Throw = {
  at: number;
  released: boolean;
  targetId: string;
  kind: FoodKind;
  seed: number;
};
type Actor = { human: Human; fan: Fan | null; throw?: Throw; held: T.Mesh };
export type CrowdLaunch = (
  origin: Point3,
  target: Racer,
  kind: FoodKind,
  seed: number
) => void;
/** Nearby skeletal throwers and distant instanced copies of the same game humans. */
export class Supporters {
  group = new T.Group();
  readonly events: ThrowEvent[] = [];
  private eventId = 0;
  wet(seed: number, time: number) {
    const fan = this.fans.find((f) => f.seed === seed);
    if (fan) {
      fan.wetUntil = time + 4.5;
      fan.nextThrow = time + 7;
    }
  }
  private fans: Fan[] = [];
  private batches: T.InstancedMesh[][] = [];
  private actors: Actor[][] = [];
  private poles: T.InstancedMesh;
  private flags: T.InstancedMesh;
  private transform = new T.Object3D();
  private clock = { value: 0 };
  private nextThrow = 2;
  private lastTime = 0;
  private egg = new T.MeshStandardMaterial({
    color: '#f5e7cf',
    roughness: 0.36
  });
  private tomato = new T.MeshStandardMaterial({
    color: '#dc2713',
    roughness: 0.22
  });
  private heldGeometry = new T.SphereGeometry(0.11, 12, 8);
  constructor(track: Track, flagTexture: T.Texture, templates: T.Group[]) {
    const stride = Math.max(
      2,
      Math.round(11 / (track.length / (track.points.length - 1)))
    );
    for (let i = 10; i < track.points.length - 1; i += stride)
      for (const side of [-1, 1]) {
        const p = track.points[i],
          offset = track.width / 2 + 2.3 + (i % 3) * 0.28;
        const x = p.x - Math.cos(p.yaw) * offset * side,
          z = p.z + Math.sin(p.yaw) * offset * side;
        if (occupied(x, z)) continue;
        const seed = i * 2 + (side + 1) / 2;
        this.fans.push({
          x,
          z,
          yaw: Math.atan2(p.x - x, p.z - z),
          seed,
          flag: i % 3 !== 0,
          scale: 0.95 + randomUnit(seed) * 0.1,
          variant: seed % templates.length,
          nextThrow: 0,
          wetUntil: 0
        });
      }
    for (const template of templates) {
      const h = cloneHuman(template);
      const batches = bakeHuman(h).map(({ geometry, material }) => {
        const mesh = new T.InstancedMesh(geometry, material, this.fans.length);
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.count = 0;
        this.group.add(mesh);
        return mesh;
      });
      this.batches.push(batches);
      h.root.traverse((o) => {
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      });
      this.actors.push(
        Array.from(
          { length: Math.max(1, Math.floor(14 / templates.length)) },
          () => {
            const human = cloneHuman(template);
            const held = new T.Mesh(this.heldGeometry, this.egg);
            held.visible = false;
            human.root.add(held);
            this.group.add(human.root);
            return { human, fan: null, held };
          }
        )
      );
    }
    const poleMaterial = new T.MeshStandardMaterial({
      color: '#dcd6bf',
      metalness: 0.2
    });
    this.poles = new T.InstancedMesh(
      new T.CylinderGeometry(0.016, 0.016, 1.4, 5),
      poleMaterial,
      this.fans.length
    );
    const flagMaterial = new T.MeshStandardMaterial({
      map: flagTexture,
      side: T.DoubleSide,
      roughness: 0.85
    });
    flagMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.fanTime = this.clock;
      shader.vertexShader = 'uniform float fanTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.z += sin(position.x * 8.0 + fanTime * 4.8) * (position.x + 0.55) * 0.10;'
      );
    };
    this.flags = new T.InstancedMesh(
      new T.PlaneGeometry(1.1, 0.78, 8, 2),
      flagMaterial,
      this.fans.length
    );
    for (const mesh of [this.poles, this.flags]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.count = 0;
      this.group.add(mesh);
    }
  }
  update(
    time: number,
    me: Racer,
    racers: Racer[],
    performance: boolean,
    running: boolean,
    launch: CrowdLaunch
  ) {
    const dt = Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    this.clock.value = time;
    const near = this.fans.filter(
      (f) => Math.hypot(f.x - me.x, f.z - me.z) < (performance ? 85 : 120)
    );
    const assignments = new Map<Fan, Actor>();
    this.actors.forEach((pool, variant) => {
      const wanted = near
        .filter(
          (f) =>
            f.variant === variant &&
            Math.hypot(f.x - me.x, f.z - me.z) < (performance ? 29 : 45)
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - me.x, a.z - me.z) -
            Math.hypot(b.x - me.x, b.z - me.z)
        )
        .slice(0, performance ? 1 : pool.length);
      // Keep a winding-up thrower assigned until release/recovery completes.
      for (const actor of pool)
        if (
          actor.throw &&
          actor.fan &&
          time - actor.throw.at < 1.45 &&
          !wanted.includes(actor.fan)
        )
          wanted.push(actor.fan);
      for (const actor of pool)
        if (actor.fan && wanted.includes(actor.fan))
          assignments.set(actor.fan, actor);
      for (const fan of wanted) {
        if (assignments.has(fan)) continue;
        const actor = pool.find((a) => !a.fan || !wanted.includes(a.fan));
        if (actor) {
          actor.fan = fan;
          actor.throw = undefined;
          assignments.set(fan, actor);
        }
      }
      for (const actor of pool) {
        actor.human.root.visible =
          !!actor.fan && assignments.get(actor.fan) === actor;
        if (!actor.human.root.visible) {
          actor.fan = null;
          actor.throw = undefined;
          actor.held.visible = false;
        }
      }
    });
    if (running && time >= this.nextThrow) {
      const candidates = [...assignments.entries()].filter(
        ([f, a]) => !a.throw && f.nextThrow <= time
      );
      let selected: {
        fan: Fan;
        actor: Actor;
        target: Racer;
        score: number;
      } | null = null;
      for (const [fan, actor] of candidates)
        for (const target of racers) {
          if (
            target.finished ||
            target.retired ||
            target.disconnected ||
            target.speed < 3
          )
            continue;
          const dx = fan.x - target.x,
            dz = fan.z - target.z;
          const distance = Math.hypot(dx, dz),
            ahead = dx * Math.sin(target.yaw) + dz * Math.cos(target.yaw);
          if (distance < 9 || distance > 28 || ahead < 2) continue;
          const score =
            distance +
            (target.id === me.id ? 0 : 8) +
            randomUnit(fan.seed + Math.floor(time)) * 5;
          if (!selected || score < selected.score)
            selected = { fan, actor, target, score };
        }
      if (selected) {
        const { fan, actor, target } = selected,
          seed = fan.seed + Math.floor(time * 10);
        actor.throw = {
          at: time,
          released: false,
          targetId: target.id,
          kind: Math.floor(time / 1.8) % 2 ? 'tomato' : 'egg',
          seed
        };
        actor.human.root.rotation.y = Math.atan2(
          target.x - fan.x,
          target.z - fan.z
        );
        fan.nextThrow = time + 8;
        this.nextThrow = time + 1.8;
      } else this.nextThrow = time + 0.3;
    }
    const counts = this.batches.map(() => 0);
    let flags = 0;
    for (const fan of near) {
      const actor = assignments.get(fan),
        m = this.transform;
      m.position.set(fan.x, 0.23, fan.z);
      m.rotation.set(0, fan.yaw, 0);
      m.scale.setScalar(fan.scale);
      m.updateMatrix();
      let hand: T.Vector3 | undefined;
      if (actor) {
        const { human } = actor;
        human.root.position.copy(m.position);
        human.root.scale.copy(m.scale);
        if (!actor.throw) human.root.rotation.y = fan.yaw;
        const age = actor.throw ? time - actor.throw.at : -1;
        if (actor.throw && age < 0.68) {
          const target = racers.find((r) => r.id === actor.throw!.targetId);
          if (target) {
            const lead = Math.max(0, 0.68 - age) + 0.6;
            const aimYaw = Math.atan2(
              target.x +
                Math.sin(target.velocityYaw) * target.speed * lead -
                fan.x,
              target.z +
                Math.cos(target.velocityYaw) * target.speed * lead -
                fan.z
            );
            const turn =
              T.MathUtils.euclideanModulo(
                aimYaw - human.root.rotation.y + Math.PI,
                Math.PI * 2
              ) - Math.PI;
            human.root.rotation.y += turn * (1 - Math.exp(-dt * 12));
          }
        }
        poseHuman(
          human,
          time + fan.seed,
          fan.wetUntil > time ? -1 : age,
          fan.flag
        );
        if (fan.wetUntil > time) {
          const w = Math.sin(
            (Math.min(1, (fan.wetUntil - time) / 0.4) * Math.PI) / 2
          );
          human.root.position.y -= 0.16 * w;
          human.root.rotation.x = -0.12 * w;
          human.root.updateWorldMatrix(true, true);
          actor.throw = undefined;
          actor.held.visible = false;
        } else human.root.rotation.x = 0;
        const throwHand = human.bones
          .get('hand_r')?.[0]
          ?.getWorldPosition(new T.Vector3());
        actor.held.visible = !!actor.throw && age < 0.68;
        if (throwHand && actor.throw) {
          actor.held.position.copy(human.root.worldToLocal(throwHand.clone()));
          actor.held.material =
            actor.throw.kind === 'egg' ? this.egg : this.tomato;
          actor.held.scale.set(1, actor.throw.kind === 'egg' ? 1.3 : 0.9, 1);
          if (age >= 0.68 && !actor.throw.released) {
            actor.throw.released = true;
            const target = racers.find((r) => r.id === actor.throw!.targetId);
            if (running && target && !target.finished && !target.retired) {
              launch(throwHand, target, actor.throw.kind, actor.throw.seed);
              this.events.unshift({
                id: ++this.eventId,
                time,
                x: fan.x,
                z: fan.z,
                seed: fan.seed
              });
              this.events.length = Math.min(16, this.events.length);
            }
          }
        }
        if (age > 1.45) actor.throw = undefined;
        hand = human.bones
          .get('hand_l')?.[0]
          ?.getWorldPosition(new T.Vector3());
      } else {
        const index = counts[fan.variant]++;
        this.batches[fan.variant].forEach((mesh) =>
          mesh.setMatrixAt(index, m.matrix)
        );
      }
      if (fan.flag) {
        const right = new T.Vector3(Math.cos(fan.yaw), 0, -Math.sin(fan.yaw));
        const origin =
          hand ||
          new T.Vector3(fan.x, 1.48, fan.z).addScaledVector(right, 0.34);
        m.position.copy(origin).add(new T.Vector3(0, 0.5, 0));
        m.rotation.set(0, fan.yaw, Math.sin(time * 3 + fan.seed) * 0.055);
        m.scale.setScalar(1);
        m.updateMatrix();
        this.poles.setMatrixAt(flags, m.matrix);
        m.position
          .copy(origin)
          .add(new T.Vector3(0, 0.9, 0))
          .addScaledVector(right, 0.54);
        m.updateMatrix();
        this.flags.setMatrixAt(flags++, m.matrix);
      }
    }
    this.batches.forEach((batch, i) =>
      batch.forEach((mesh) => {
        mesh.count = counts[i];
        mesh.instanceMatrix.needsUpdate = true;
      })
    );
    for (const mesh of [this.flags, this.poles]) {
      mesh.count = flags;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  dispose() {
    this.group.removeFromParent();
    this.batches.flat().forEach((m) => {
      m.geometry.dispose();
      m.dispose();
    });
    for (const m of [this.poles, this.flags]) {
      m.geometry.dispose();
      (m.material as T.Material).dispose();
      m.dispose();
    }
    this.actors.flat().forEach((a) =>
      a.human.root.traverse((o) => {
        if (o instanceof T.SkinnedMesh) o.skeleton.dispose();
      })
    );
    this.heldGeometry.dispose();
    this.egg.dispose();
    this.tomato.dispose();
  }
  get count() {
    return this.fans.length;
  }
}
