import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

type Rig = {
  root: T.Group;
  bones: Map<string, T.Bone[]>;
  rest: Map<T.Bone, T.Quaternion>;
  eye: T.Object3D;
};
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
export function createRider(source: T.Group): Rig {
  const model = clone(source) as T.Group;
  model.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(model),
    scale = 1.76 / (bounds.max.y - bounds.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y = -bounds.min.y * scale;
  const root = new T.Group();
  root.add(model);
  root.position.set(0, -0.08, -0.05);
  const bones = new Map<string, T.Bone[]>(),
    rest = new Map<T.Bone, T.Quaternion>();
  model.traverse((o) => {
    if (o instanceof T.Bone) {
      bones.set(o.name, [...(bones.get(o.name) || []), o]);
      rest.set(o, o.quaternion.clone());
    }
    if (o instanceof T.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o instanceof T.SkinnedMesh) o.frustumCulled = false;
    }
  });
  const eye = new T.Object3D();
  const head = bones.get('Head')?.[0];
  if (head) {
    const eyes = model.getObjectByName('Eyes');
    if (eyes) {
      const center = new T.Box3().setFromObject(eyes, true).getCenter(v());
      eye.position.copy(head.worldToLocal(center));
      eye.position.z += 0.02;
    } else {
      eye.position.set(0, 0.1, 0.13);
    }
    head.add(eye);
  } else {
    eye.position.set(0, 1.62, 0.12);
    root.add(eye);
  }
  return { root, bones, rest, eye };
}
function aim(a: T.Bone, b: T.Bone, target: T.Vector3) {
  a.updateWorldMatrix(true, true);
  const origin = a.getWorldPosition(v()),
    from = b.getWorldPosition(v()).sub(origin).normalize(),
    to = target.clone().sub(origin).normalize();
  const parent = a.parent!.getWorldQuaternion(new T.Quaternion()).invert();
  a.quaternion.copy(
    parent.multiply(
      new T.Quaternion()
        .setFromUnitVectors(from, to)
        .multiply(a.getWorldQuaternion(new T.Quaternion()))
    )
  );
  a.updateWorldMatrix(false, true);
}
function limb(r: Rig, names: string[], target: T.Vector3, pole: T.Vector3) {
  (r.bones.get(names[0]) || []).forEach((a, i) => {
    const b = r.bones.get(names[1])?.[i],
      c = r.bones.get(names[2])?.[i];
    if (!b || !c) return;
    const origin = a.getWorldPosition(v()),
      elbow = b.getWorldPosition(v());
    const l1 = origin.distanceTo(elbow),
      l2 = elbow.distanceTo(c.getWorldPosition(v()));
    if (l1 < 0.001 || l2 < 0.001) return;
    const direction = target.clone().sub(origin),
      d = T.MathUtils.clamp(
        direction.length(),
        Math.abs(l1 - l2) + 0.002,
        l1 + l2 - 0.002
      );
    direction.normalize();
    const co = T.MathUtils.clamp(
      (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d),
      -1,
      1
    );
    const bend = pole
      .clone()
      .addScaledVector(direction, -pole.dot(direction))
      .normalize();
    elbow
      .copy(origin)
      .addScaledVector(direction, l1 * co)
      .addScaledVector(bend, l1 * Math.sqrt(1 - co * co));
    aim(a, b, elbow);
    aim(b, c, target);
  });
}
/** Rider, hands and feet use world targets on the same moving hull. */
export function poseRider(
  r: Rig,
  hull: T.Group,
  steer: number,
  speed: number,
  time: number,
  airborne: boolean
) {
  for (const [b, q] of r.rest) b.quaternion.copy(q);
  hull.updateWorldMatrix(true, true);
  const world = (x: number, y: number, z: number) =>
    hull.localToWorld(v(x, y, z));
  const pole = (x: number, y: number, z: number) =>
    v(x, y, z).transformDirection(hull.matrixWorld);
  (r.bones.get('spine_01') || []).forEach((b, i) => {
    const top = r.bones.get('spine_03')?.[i];
    if (top)
      aim(b, top, world(steer * 0.04, 1.32 + (airborne ? 0.015 : 0), 0.24));
  });
  hull.updateWorldMatrix(true, true);
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1]
  ] as const) {
    limb(
      r,
      [`upperarm_${side}`, `lowerarm_${side}`, `hand_${side}`],
      world(sign * 0.37, 1.035, 0.42 + sign * steer * 0.08),
      pole(sign, -0.4, -0.2)
    );
    limb(
      r,
      [`thigh_${side}`, `calf_${side}`, `foot_${side}`],
      world(sign * 0.4, 0.43, -0.43),
      pole(sign * 0.2, 0.1, 1)
    );
  }
  const uprightHead = new T.Quaternion().setFromAxisAngle(v(1), -0.48);
  for (const neck of r.bones.get('neck_01') ?? [])
    neck.quaternion.multiply(uprightHead);
  for (const b of r.bones.get('Head') || [])
    b.quaternion.multiply(
      new T.Quaternion().setFromEuler(
        new T.Euler(0, -steer * 0.042, Math.sin(time * 2) * 0.012)
      )
    );
}

/** The rider releases the grips, tumbles, then floats until the remount. */
export function poseFallingRider(r: Rig, age: number, aboveWater: boolean) {
  for (const [bone, rest] of r.rest) bone.quaternion.copy(rest);
  const settle = T.MathUtils.smoothstep(age, 0.35, 0.85);
  const motion = Math.sin(age * 7) * (aboveWater ? 0.18 : 0.07);
  const turn = (name: string, x: number, y: number, z: number) => {
    const rotation = new T.Quaternion().setFromEuler(new T.Euler(x, y, z));
    for (const bone of r.bones.get(name) ?? [])
      bone.quaternion.multiply(rotation);
  };
  turn('spine_01', 0.22 * (1 - settle), 0.13 + motion, 0.16);
  for (const [side, sign] of [
    ['l', 1],
    ['r', -1]
  ] as const) {
    turn(
      `upperarm_${side}`,
      0.38 + motion,
      sign * 0.36,
      sign * (0.5 + settle * 0.32)
    );
    turn(`lowerarm_${side}`, 0, sign * (0.55 - settle * 0.25), 0);
    turn(`thigh_${side}`, -0.4 + settle * 0.23, sign * 0.14, sign * 0.13);
    turn(`calf_${side}`, 0.65 - settle * 0.45 + motion * sign, 0, 0);
  }
}
