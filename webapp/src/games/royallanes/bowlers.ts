import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
const UP = new T.Vector3(0, 1, 0);
function rotateToward(bone: T.Bone | undefined, target: T.Vector3) {
  if (!bone) return;
  const child = bone.children.find((c) => (c as T.Bone).isBone);
  if (!child) return;
  const origin = bone.getWorldPosition(new T.Vector3());
  const from = child.getWorldPosition(new T.Vector3()).sub(origin).normalize(),
    to = target.clone().sub(origin).normalize();
  const world = new T.Quaternion()
    .setFromUnitVectors(from, to)
    .multiply(bone.getWorldQuaternion(new T.Quaternion()));
  const parent =
    bone.parent?.getWorldQuaternion(new T.Quaternion()) ?? new T.Quaternion();
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateMatrixWorld(true);
}
function arm(
  upper: T.Bone | undefined,
  lower: T.Bone | undefined,
  hand: T.Bone | undefined,
  target: T.Vector3,
  pole: T.Vector3
) {
  if (!upper || !lower || !hand) return;
  const shoulder = upper.getWorldPosition(new T.Vector3()),
    elbow = lower.getWorldPosition(new T.Vector3()),
    wrist = hand.getWorldPosition(new T.Vector3());
  const a = shoulder.distanceTo(elbow),
    b = elbow.distanceTo(wrist);
  const axis = target.clone().sub(shoulder);
  const d = T.MathUtils.clamp(
    axis.length(),
    Math.abs(a - b) + 0.005,
    a + b - 0.003
  );
  axis.normalize();
  const along = (a * a + d * d - b * b) / (2 * d),
    height = Math.sqrt(Math.max(0, a * a - along * along));
  const bend = pole
    .clone()
    .sub(shoulder)
    .addScaledVector(axis, -pole.clone().sub(shoulder).dot(axis))
    .normalize();
  const solved = shoulder
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(bend, height);
  rotateToward(upper, solved);
  rotateToward(lower, shoulder.clone().addScaledVector(axis, d));
}
/** Canonical names let the existing RPM and Quaternius rigs share bowling IK. */
const aliases: Record<string, string> = {
  pelvis: 'hips',
  spine01: 'spine',
  spine02: 'spine1',
  spine03: 'spine2',
  neck01: 'neck',
  upperarml: 'leftarm',
  lowerarml: 'leftforearm',
  handl: 'lefthand',
  upperarmr: 'rightarm',
  lowerarmr: 'rightforearm',
  handr: 'righthand',
  thighl: 'leftupleg',
  calfl: 'leftleg',
  footl: 'leftfoot',
  thighr: 'rightupleg',
  calfr: 'rightleg',
  footr: 'rightfoot'
};
function boneKey(name: string) {
  // GLTFLoader adds _1 to duplicate clothing skeletons. Preserve finger indices.
  const key = name
    .replace(/_[1-9]\d*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const finger = key.match(/^(index|middle|ring|pinky|thumb)0([123])([lr])$/);
  return (
    aliases[key] ||
    (finger
      ? `${finger[3] === 'l' ? 'left' : 'right'}hand${finger[1]}${finger[2]}`
      : key)
  );
}
export type BowlerPose = {
  active: boolean;
  rolling: boolean;
  elapsed: number;
  dt: number;
  watching: boolean;
  time: number;
  releaseSeconds?: number;
  reaction?: 'strike' | 'spare' | 'miss' | 'neutral';
  reactionElapsed?: number;
};
export class HumanBowler {
  root = new T.Group();
  model: T.Object3D;
  bones = new Map<string, T.Bone>();
  private followers: { bone: T.Bone; source: T.Bone }[] = [];
  private rest = new Map<T.Bone, T.Quaternion>();
  private positionRest = new Map<T.Bone, T.Vector3>();
  private feetRest = new Map<string, T.Quaternion>();
  private target = new T.Vector3();
  ballSocket = new T.Vector3();
  eye = new T.Vector3();
  phase = 'ready';
  constructor(
    prototype: T.Object3D,
    shirt: number,
    private firstPerson: boolean
  ) {
    this.model = clone(prototype);
    this.root.add(this.model);
    this.model.rotation.y = Math.PI;
    this.model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(this.model);
    const height = box.max.y - box.min.y;
    this.model.scale.multiplyScalar(height > 0 ? 1.78 / height : 1);
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    const center = box.getCenter(new T.Vector3());
    this.model.position.set(-center.x, -box.min.y, -center.z);
    this.model.traverse((object) => {
      if ((object as T.Bone).isBone) {
        const bone = object as T.Bone,
          key = boneKey(bone.name);
        const source = this.bones.get(key);
        if (source) this.followers.push({ bone, source });
        else this.bones.set(key, bone);
        this.rest.set(bone, bone.quaternion.clone());
        this.positionRest.set(bone, bone.position.clone());
      }
      if (object instanceof T.Mesh) {
        object.castShadow = !firstPerson;
        object.receiveShadow = true;
        object.frustumCulled = false;
        object.material = (
          Array.isArray(object.material) ? object.material : [object.material]
        ).map((material) => {
          const m = material.clone() as T.MeshStandardMaterial;
          if (/outfit_top/i.test(object.name))
            m.color.multiply(new T.Color(shirt));
          return m;
        });
        if (firstPerson && /head|eye|teeth|beard|hair/i.test(object.name))
          object.layers.set(2);
      }
    });
    this.root.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
      const foot = this.bones.get(`${side}foot`);
      if (foot)
        this.feetRest.set(side, foot.getWorldQuaternion(new T.Quaternion()));
    }
  }
  pose({
    active,
    rolling,
    elapsed,
    dt,
    watching,
    time,
    releaseSeconds = 2.2,
    reaction = 'neutral',
    reactionElapsed = -1
  }: BowlerPose) {
    for (const [b, q] of this.rest) {
      b.quaternion.copy(q);
      b.position.copy(this.positionRest.get(b)!);
    }
    const u = rolling ? Math.max(0, elapsed / releaseSeconds) : 0;
    const progress = T.MathUtils.smoothstep(u, 0, 1);
    // Four steps: pushaway, pendulum backswing, forward swing, then sliding release.
    const lunge =
      T.MathUtils.smoothstep(u, 0.6, 1) *
      (1 - T.MathUtils.smoothstep(u, 1.45, 2.0));
    this.phase = !active
      ? 'watch'
      : !rolling
        ? 'ready'
        : u < 0.25
          ? 'pushaway'
          : u < 0.65
            ? 'backswing'
            : u < 1
              ? 'slide'
              : u < 1.45
                ? 'follow-through'
                : 'watch';
    this.target.set(
      active ? -0.16 : this.firstPerson ? -0.4 : 1.14,
      0,
      active ? 2.18 - progress * 1.72 : this.firstPerson ? 4.8 : 3.25
    );
    // Release follows the replay clock exactly, including reconnects/frame drops.
    if (active && rolling) this.root.position.copy(this.target);
    else
      this.root.position.lerp(
        this.target,
        1 - Math.exp(-dt * (active ? 6 : 2.2))
      );
    const walking =
      !rolling && this.root.position.distanceTo(this.target) > 0.035;
    if (walking) this.phase = active ? 'approach-ready' : 'return';
    const hips = this.bones.get('hips');
    this.root.updateMatrixWorld(true);
    if (hips?.parent) {
      const lowered = hips.getWorldPosition(new T.Vector3());
      lowered.y -= lunge * 0.43;
      hips.position.copy(hips.parent.worldToLocal(lowered));
      hips.rotation.x += lunge * 1.05;
    }
    const spine = this.bones.get('spine'),
      chest = this.bones.get('spine2');
    if (spine) spine.rotation.x += lunge * 0.55;
    if (chest) {
      chest.rotation.x += lunge * 0.08 + Math.sin(time * 0.0015) * 0.009;
      chest.rotation.y += rolling
        ? Math.sin(Math.min(u, 1) * Math.PI) * 0.1
        : 0;
    }
    const head = this.bones.get('head');
    if (head && !this.firstPerson)
      head.rotation.y += watching ? Math.sin(time * 0.0007) * 0.07 : 0;
    this.root.updateMatrixWorld(true);
    const base = this.root.getWorldPosition(new T.Vector3());
    const right = new T.Vector3(0.22, 1.26, -0.52),
      left = new T.Vector3(0.1, 1.25, -0.5);
    if (active && rolling) {
      const keys = [
        [0, 0.22, 1.26, -0.52],
        [0.25, 0.28, 0.99, -0.64],
        [0.62, 0.3, 0.86, 0.4],
        [1, 0.16, 0.1105, -0.5],
        [1.25, 0.18, 1.31, -0.64],
        [1.55, 0.24, 1.05, -0.3],
        [2, 0.27, 0.85, -0.06]
      ];
      let i = 0;
      while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
      const a = keys[i],
        b = keys[i + 1],
        t = T.MathUtils.clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
      // Cubic tangents carry the pendulum through release instead of stopping at every pose.
      const tangent = (k: number, c: number) => {
        if (k === 0 || k === keys.length - 1 || (c === 2 && keys[k][0] === 1))
          return 0;
        return (
          (keys[k + 1][c] - keys[k - 1][c]) / (keys[k + 1][0] - keys[k - 1][0])
        );
      };
      const value = (c: number) =>
        (2 * t * t * t - 3 * t * t + 1) * a[c] +
        (t * t * t - 2 * t * t + t) * (b[0] - a[0]) * tangent(i, c) +
        (-2 * t * t * t + 3 * t * t) * b[c] +
        (t * t * t - t * t) * (b[0] - a[0]) * tangent(i + 1, c);
      right.set(value(1), Math.max(0.1105, value(2)), value(3));
      left.lerp(
        new T.Vector3(-0.49, 1.09, 0.02),
        T.MathUtils.smoothstep(u, 0.15, 0.65)
      );
      left.lerp(
        new T.Vector3(-0.27, 0.85, -0.06),
        T.MathUtils.smoothstep(u, 1.55, 2)
      );
    } else if (!active) {
      right.set(0.27, 0.85, -0.06);
      left.set(-0.27, 0.85, -0.06);
    }
    if (walking) {
      const gait = Math.sin(time * 0.007) * 0.13;
      right.z += gait;
      left.z -= gait;
    }
    if (reactionElapsed >= 0) {
      const envelope =
        T.MathUtils.smoothstep(reactionElapsed, 0, 0.35) *
        (1 - T.MathUtils.smoothstep(reactionElapsed, 1.2, 2.1));
      if (reaction === 'strike' || reaction === 'spare') {
        right.lerp(
          new T.Vector3(0.32, reaction === 'strike' ? 1.85 : 1.48, -0.16),
          envelope
        );
        if (reaction === 'strike')
          left.lerp(new T.Vector3(-0.34, 1.65, -0.1), envelope);
      } else if (reaction === 'miss' && head)
        head.rotation.x += envelope * 0.15;
      if (envelope > 0) this.phase = 'reaction';
    }
    right.add(base);
    left.add(base);
    arm(
      this.bones.get('rightarm'),
      this.bones.get('rightforearm'),
      this.bones.get('righthand'),
      right,
      base.clone().add(new T.Vector3(0.56, 1.06, 0.07))
    );
    arm(
      this.bones.get('leftarm'),
      this.bones.get('leftforearm'),
      this.bones.get('lefthand'),
      left,
      base.clone().add(new T.Vector3(-0.5, 1.02, -0.02))
    );
    for (const side of ['left', 'right']) {
      const foot = this.bones.get(`${side}foot`),
        sx = side === 'left' ? -0.15 : 0.15;
      // Alternate planted feet. Only the swinging foot lifts; the final left foot slides.
      const step = Math.min(3.9999, u * 4),
        stepIndex = Math.floor(step),
        stepT = step - stepIndex;
      const swingSide = stepIndex % 2 === 0 ? 'right' : 'left';
      let footZ = base.z,
        lift = 0;
      if (active && rolling && u < 1) {
        let planted = 2.18;
        for (let n = 0; n <= stepIndex; n++)
          if ((n % 2 === 0 ? 'right' : 'left') === side) {
            const landing = 2.18 - (n + 1) * 0.43;
            if (n === stepIndex) {
              footZ = T.MathUtils.lerp(
                planted,
                landing,
                T.MathUtils.smoothstep(stepT, 0, 1)
              );
              lift = Math.sin(stepT * Math.PI) * (n === 3 ? 0.025 : 0.065);
            } else planted = landing;
          }
        if (swingSide !== side) footZ = planted;
      } else if (active && rolling)
        footZ +=
          side === 'right'
            ? 0.43 * (1 - T.MathUtils.smoothstep(u, 1.55, 2))
            : 0;
      else if (walking) {
        const gait = Math.sin(time * 0.007 + (side === 'left' ? 0 : Math.PI));
        footZ += gait * 0.13;
        lift = Math.max(0, gait) * 0.05;
      }
      const footTarget = new T.Vector3(
        base.x + sx + (side === 'right' ? -lunge * 0.18 : 0),
        0.075 + lift,
        footZ
      );
      arm(
        this.bones.get(`${side}upleg`),
        this.bones.get(`${side}leg`),
        foot,
        footTarget,
        base.clone().add(new T.Vector3(sx, 0.5, -0.45))
      );
      if (foot) {
        const parent =
          foot.parent?.getWorldQuaternion(new T.Quaternion()) ??
          new T.Quaternion();
        foot.quaternion.copy(
          parent.invert().multiply(this.feetRest.get(side)!)
        );
      }
    }
    const grip = active && (!rolling || u < 1) ? 0.42 : 0.08;
    for (const [name, bone] of this.bones)
      if (/hand(index|middle|ring|pinky)[123]$/.test(name))
        bone.rotation.z += (name.startsWith('right') ? -1 : 1) * grip;
    // Clothing and body in the athlete GLBs have independent skeletons.
    for (const { bone, source } of this.followers) {
      bone.quaternion.copy(source.quaternion);
      bone.position.copy(source.position);
    }
    this.root.updateMatrixWorld(true);
    const hand = this.bones.get('righthand');
    if (hand) hand.getWorldPosition(this.ballSocket);
    else this.ballSocket.copy(right);
    // Palm-to-centre offset fades to the lane's exact launch centre at release.
    this.ballSocket.y += 0.075 * (1 - T.MathUtils.smoothstep(u, 0.8, 1));
    if (head) head.getWorldPosition(this.eye);
    else this.eye.copy(base).add(new T.Vector3(0, 1.65, 0));
    this.eye.add(new T.Vector3(0, 0.055, -0.085));
    // Sockets are in the lane parent's coordinates, just like its ball and camera.
    // IK above uses world positions so translated neighbour lanes retain their own limbs.
    if (this.root.parent) {
      this.root.parent.worldToLocal(this.ballSocket);
      this.root.parent.worldToLocal(this.eye);
    }
  }
  dispose() {
    const skeletons = new Set<T.Skeleton>();
    this.model.traverse((o) => {
      if (o instanceof T.SkinnedMesh) skeletons.add(o.skeleton);
      if (o instanceof T.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
    });
    skeletons.forEach((s) => s.dispose());
  }
}
