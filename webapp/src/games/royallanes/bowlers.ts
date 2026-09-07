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
export class HumanBowler {
  root = new T.Group();
  model: T.Object3D;
  bones = new Map<string, T.Bone>();
  private rest = new Map<T.Bone, T.Quaternion>();
  private positionRest = new Map<T.Bone, T.Vector3>();
  private target = new T.Vector3();
  ballSocket = new T.Vector3();
  eye = new T.Vector3();
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
    this.model.scale.setScalar(height > 0 ? 1.78 / height : 1);
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    const center = box.getCenter(new T.Vector3());
    this.model.position.set(-center.x, -box.min.y, -center.z);
    this.model.traverse((object) => {
      if ((object as T.Bone).isBone) {
        const bone = object as T.Bone;
        this.bones.set(bone.name.toLowerCase().replace(/[^a-z0-9]/g, ''), bone);
        this.rest.set(bone, bone.quaternion.clone());
        this.positionRest.set(bone, bone.position.clone());
      }
      if (object instanceof T.Mesh) {
        object.castShadow = true;
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
  }
  private bone(name: string) {
    return this.bones.get(name.toLowerCase());
  }
  pose({
    active,
    rolling,
    elapsed,
    dt,
    watching,
    time
  }: {
    active: boolean;
    rolling: boolean;
    elapsed: number;
    dt: number;
    watching: boolean;
    time: number;
  }) {
    for (const [b, q] of this.rest) {
      b.quaternion.copy(q);
      b.position.copy(this.positionRest.get(b)!);
    }
    const approach = rolling ? T.MathUtils.smoothstep(elapsed, 0, 0.95) : 0;
    const isLocal = this.firstPerson;
    this.target.set(
      active ? -0.16 : isLocal ? -0.4 : 1.14,
      0,
      active ? 2.18 - approach * 1.72 : isLocal ? 4.8 : 3.25
    );
    this.root.position.lerp(this.target, 1 - Math.exp(-dt * (active ? 7 : 3)));
    const hips = this.bone('hips');
    const lunge = Math.sin((approach * Math.PI) / 2);
    if (hips) hips.position.y -= lunge * 0.57;
    const spine = this.bone('spine');
    if (spine && active && rolling) spine.rotation.x += lunge * 0.85;
    const chest = this.bone('spine2');
    if (chest)
      chest.rotation.x +=
        active && rolling
          ? 0.08 * lunge
          : Math.sin(time * 0.0015) * 0.009;
    const stride =
      rolling && elapsed < 0.95 ? Math.sin((elapsed / 0.95) * Math.PI * 3) : 0;
    this.root.updateMatrixWorld(true);
    const base = this.root.position;
    const right = new T.Vector3(0.22, 1.26, -0.52),
      left = new T.Vector3(0.1, 1.25, -0.5);
    if (active && rolling) {
      if (elapsed < 0.5) {
        const t = T.MathUtils.smoothstep(elapsed, 0, 0.5);
        right.lerp(new T.Vector3(0.29, 0.77, 0.38), t);
        left.lerp(new T.Vector3(-0.43, 1.2, -0.12), t);
      } else if (elapsed < 1.15) {
        const t = T.MathUtils.smoothstep(elapsed, 0.5, 1.15);
        right.set(0.29, 0.77, 0.38).lerp(new T.Vector3(0.17, 0.18, -0.47), t);
        left.set(-0.43, 1.2, -0.12).lerp(new T.Vector3(-0.48, 1.1, 0.04), t);
      } else {
        const t = T.MathUtils.smoothstep(elapsed, 1.15, 1.65);
        right.set(0.17, 0.18, -0.47).lerp(new T.Vector3(0.16, 1.37, -0.6), t);
        left.set(-0.48, 1.1, 0.04);
        if (elapsed > 2.8) {
          const relax = T.MathUtils.smoothstep(elapsed, 2.8, 4.2);
          right.lerp(new T.Vector3(0.28, 0.88, -0.04), relax);
          left.lerp(new T.Vector3(-0.28, 0.88, -0.04), relax);
        }
      }
    } else if (!active) {
      right.set(0.27, 0.85, -0.06);
      left.set(-0.27, 0.85, -0.06);
    }
    right.add(base);
    left.add(base);
    arm(
      this.bone('rightarm'),
      this.bone('rightforearm'),
      this.bone('righthand'),
      right,
      base.clone().add(new T.Vector3(0.56, 1.06, 0.07))
    );
    arm(
      this.bone('leftarm'),
      this.bone('leftforearm'),
      this.bone('lefthand'),
      left,
      base.clone().add(new T.Vector3(-0.5, 1.02, -0.02))
    );
    for (const side of ['left', 'right']) {
      const upper = this.bone(`${side}upleg`),
        lower = this.bone(`${side}leg`),
        foot = this.bone(`${side}foot`);
      const sx = side === 'left' ? -0.15 : 0.15;
      const step = (side === 'left' ? stride : -stride) * 0.15;
      const footTarget = base
        .clone()
        .add(
          new T.Vector3(
            sx,
            0.075,
            step + (side === 'right' ? approach * 0.28 : -approach * 0.15)
          )
        );
      arm(
        upper,
        lower,
        foot,
        footTarget,
        base.clone().add(new T.Vector3(sx, 0.5, -0.45))
      );
      if (foot) {
        const parent =
          foot.parent?.getWorldQuaternion(new T.Quaternion()) ??
          new T.Quaternion();
        foot.quaternion.copy(
          parent
            .invert()
            .multiply(new T.Quaternion().setFromAxisAngle(UP, Math.PI))
        );
      }
    }
    // Curl actual finger bones around the ball rather than drawing detached hands.
    for (const [name, bone] of this.bones)
      if (/hand(index|middle|ring|pinky)[123]$/.test(name))
        bone.rotation.z +=
          (name.startsWith('right') ? -1 : 1) *
          (active && !rolling ? 0.42 : 0.2);
    this.root.updateMatrixWorld(true);
    const hand = this.bone('righthand');
    if (hand) hand.getWorldPosition(this.ballSocket);
    else this.ballSocket.copy(right);
    this.ballSocket.add(
      new T.Vector3(
        -0.015,
        active && rolling && elapsed > 0.7 && elapsed < 1.4 ? 0.015 : 0.075,
        -0.015
      )
    );
    const head = this.bone('head');
    if (head) head.getWorldPosition(this.eye);
    else this.eye.copy(base).add(new T.Vector3(0, 1.65, 0));
    this.eye.add(new T.Vector3(0, 0.055, -0.085));
  }
  dispose() {
    this.model.traverse((o) => {
      if (o instanceof T.Mesh)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
    });
  }
}
