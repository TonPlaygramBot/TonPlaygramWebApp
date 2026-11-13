import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  humanoidBones,
  headBoneIndices,
  normalizePlayableHuman,
  solveHumanoidLimb
} from '../tiranastreets/street-career/humanoidRig.mjs';
import { solveHumanoidGrip } from '../tiranastreets/street-career/humanoidHands.mjs';
import { driverPose } from './driverPose.mjs';
import type { Racer } from './simulation.mjs';

/** Turi's original skin follows the same steering/pedal contacts as the kart.
 * Each car owns its skeleton/material instances; the embedded atlas is shared. */
export class TuriKartDriver {
  readonly root = new T.Group();
  readonly bones: Map<string, T.Bone>;
  private body: T.Group;
  private rest = new Map<T.Bone, T.Quaternion>();
  private base = new T.Vector3();
  private masks: {
    mesh: T.SkinnedMesh;
    full: T.BufferGeometry;
    eyes: T.BufferGeometry;
  }[] = [];
  private disposed = false;
  private lastImpact = 0;
  private impactTime = -10;
  private impactSide = 0;
  private impactForward = 0;
  constructor(source: T.Group, _color: string, raised = false) {
    this.root.name = 'Turi kart driver';
    this.root.position.y = raised ? 0.1 : 0;
    this.root.userData.characterId = 'turi';
    this.body = normalizePlayableHuman(clone(source), 1.76);
    this.root.add(this.body);
    this.bones = humanoidBones(this.body);
    this.root.updateMatrixWorld(true);
    const hip = this.root.worldToLocal(
      this.bones.get('hips')!.getWorldPosition(new T.Vector3())
    );
    // Sit toward the cushion front so Turi's original leg lengths reach the pedals.
    this.body.position.set(-hip.x, 0.47 - hip.y, -0.08 - hip.z);
    this.base.copy(this.body.position);
    this.body.traverse((o) => {
      if (o instanceof T.Bone) this.rest.set(o, o.quaternion.clone());
      if (!(o instanceof T.Mesh)) return;
      o.castShadow = o.receiveShadow = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
      if (!(o instanceof T.SkinnedMesh)) return;
      o.frustumCulled = false;
      const full = o.geometry,
        weights = full.getAttribute('skinWeight'),
        joints = full.getAttribute('skinIndex');
      const head = headBoneIndices(o.skeleton),
        index = full.getIndex(),
        keep: number[] = [];
      const isHead = (vertex: number) =>
        [0, 1, 2, 3].reduce(
          (sum, j) =>
            sum +
            (head.has(joints.getComponent(vertex, j))
              ? weights.getComponent(vertex, j)
              : 0),
          0
        ) > 0.3;
      const eyes = full.clone(),
        count = index?.count || full.getAttribute('position').count;
      eyes.clearGroups();
      for (let i = 0; i < count; i += 3) {
        const ids = [0, 1, 2].map((j) => (index ? index.getX(i + j) : i + j));
        if (ids.some(isHead)) continue;
        const materialIndex =
          full.groups.find(
            (g: { start: number; count: number; materialIndex?: number }) =>
              i >= g.start && i < g.start + g.count
          )?.materialIndex || 0;
        const previous = eyes.groups.at(-1);
        if (previous?.materialIndex === materialIndex) previous.count += 3;
        else eyes.addGroup(keep.length, 3, materialIndex);
        keep.push(...ids);
      }
      eyes.setIndex(keep);
      this.masks.push({ mesh: o, full, eyes });
    });
    this.root.userData.releaseKartDriver = () => this.dispose();
    // The garage has no racer simulation yet; show the seated pose immediately.
    this.update(
      {
        steering: 0,
        acceleration: 0,
        yawRate: 0,
        speed: 0,
        throttle: 0,
        braking: false
      } as Racer,
      0,
      false,
      true
    );
  }
  update(r: Racer, time: number, firstPerson: boolean, reduced = false) {
    for (const [bone, q] of this.rest) bone.quaternion.copy(q);
    if ((r.impactId || 0) > this.lastImpact) {
      this.lastImpact = r.impactId;
      this.impactTime = time;
      this.impactSide =
        (Math.cos(r.yaw) * r.impactNx - Math.sin(r.yaw) * r.impactNz) *
        r.impact *
        0.035;
      this.impactForward =
        (Math.sin(r.yaw) * r.impactNx + Math.cos(r.yaw) * r.impactNz) *
        r.impact *
        0.045;
    }
    const age = Math.max(0, time - this.impactTime),
      impulse = Math.sin(age * 18) * Math.exp(-age * 7);
    const pose = driverPose(
      r.steering,
      r.acceleration,
      r.yawRate,
      r.speed,
      time,
      reduced,
      {
        side: this.impactSide * impulse,
        forward: this.impactForward * impulse,
        throttle: r.throttle,
        brake: r.braking ? 1 : 0,
        landing: r.landingImpact || 0
      }
    );
    this.body.position
      .copy(this.base)
      .add(new T.Vector3(pose.lean * 0.5, pose.breath, pose.recoil * 0.5));
    this.root.updateWorldMatrix(true, true);
    const world = (p: number[]) => this.root.localToWorld(new T.Vector3(...p));
    const direction = (x: number, y: number, z: number) =>
      new T.Vector3(x, y, z).transformDirection(this.root.matrixWorld);
    for (const [side, key] of [
      ['left', 'l'],
      ['right', 'r']
    ] as const) {
      const sign = side === 'left' ? 1 : -1;
      // Tangent follows the same wheel angle used by the visible steering rim.
      solveHumanoidGrip(
        this.root,
        this.bones,
        side,
        world(pose.arms[key].hand),
        direction(-Math.sin(pose.wheelAngle), Math.cos(pose.wheelAngle), 0),
        direction(0, 0, -sign),
        0.85
      );
      solveHumanoidLimb(
        this.root,
        this.bones,
        side,
        world(pose.legs[key].ankle),
        true
      );
    }
    const head = this.bones.get('head');
    if (head)
      head.quaternion.multiply(
        new T.Quaternion().setFromEuler(
          new T.Euler(pose.headPitch, pose.headYaw, 0)
        )
      );
    for (const mask of this.masks)
      mask.mesh.geometry = firstPerson ? mask.eyes : mask.full;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, full, eyes } of this.masks) {
      mesh.geometry = full;
      eyes.dispose();
      mesh.skeleton.dispose();
    }
    this.masks = [];
  }
}
