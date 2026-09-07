import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Human = {
  root: T.Group;
  bones: Map<string, T.Bone[]>;
  rest: Map<T.Bone, T.Quaternion>;
};
const vec = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const clamp = T.MathUtils.clamp;

/** The exact Quaternius male/female GLBs already used by Table Tennis Royal. */
export function prepareHuman(source: T.Group, female: boolean): T.Group {
  const root = clone(source) as T.Group;
  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root);
  const scale = 1.78 / (bounds.max.y - bounds.min.y);
  root.scale.multiplyScalar(scale);
  root.position.y = -bounds.min.y * scale;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    o.frustumCulled = false;
    o.castShadow = true;
    o.receiveShadow = true;
    if (o instanceof T.SkinnedMesh && /superhero/i.test(o.name)) {
      o.skeleton.update();
      o.geometry = o.geometry.clone();
      const p = o.geometry.attributes.position;
      const colors = new Float32Array(p.count * 3);
      const skin = new T.Color(female ? '#ba8766' : '#d0a180');
      const shirt = new T.Color(female ? '#e8e4da' : '#c72131');
      const trousers = new T.Color('#202732');
      const trim = new T.Color('#971322');
      const shoe = new T.Color('#e9e8e1');
      for (let i = 0; i < p.count; i++) {
        const v = vec().fromBufferAttribute(p, i);
        o.applyBoneTransform(i, v).applyMatrix4(o.matrixWorld);
        const x = Math.abs(v.x),
          y = v.y;
        const top = y > 1.01 && y < 1.56 && x < 0.47 && !(y > 1.51 && x < 0.1);
        const color =
          y < 0.15
            ? shoe
            : y < 1.02
              ? trousers
              : top
                ? y < 1.065
                  ? trim
                  : shirt
                : skin;
        color.toArray(colors, i * 3);
      }
      o.geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      o.material = new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0
      });
    }
  });
  const wrapper = new T.Group();
  wrapper.add(root);
  return wrapper;
}

export function cloneHuman(template: T.Group): Human {
  const root = clone(template) as T.Group;
  const bones = new Map<string, T.Bone[]>();
  const rest = new Map<T.Bone, T.Quaternion>();
  root.traverse((o) => {
    if (!(o instanceof T.Bone)) return;
    bones.set(o.name, [...(bones.get(o.name) || []), o]);
    rest.set(o, o.quaternion.clone());
  });
  return { root, bones, rest };
}

// World-space two-bone IK, using the same anatomical skeleton as Tennis Royal.
// All duplicate hair bones are posed too, so hair follows the head correctly.
function aim(bone: T.Bone, child: T.Bone, target: T.Vector3) {
  if (!bone.parent) return;
  bone.updateWorldMatrix(true, true);
  const origin = bone.getWorldPosition(vec());
  const from = child.getWorldPosition(vec()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  if (to.lengthSq() < 1e-8) return;
  const delta = new T.Quaternion().setFromUnitVectors(from, to);
  const world = bone.getWorldQuaternion(new T.Quaternion());
  const parent = bone.parent.getWorldQuaternion(new T.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(delta.multiply(world)));
  bone.updateWorldMatrix(false, true);
}
function limb(h: Human, names: string[], target: T.Vector3, pole: T.Vector3) {
  const upper = h.bones.get(names[0]) || [];
  upper.forEach((a, i) => {
    const b = h.bones.get(names[1])?.[i],
      c = h.bones.get(names[2])?.[i];
    if (!b || !c) return;
    const origin = a.getWorldPosition(vec()),
      elbow = b.getWorldPosition(vec());
    const l1 = origin.distanceTo(elbow),
      l2 = elbow.distanceTo(c.getWorldPosition(vec()));
    if (l1 < 0.001 || l2 < 0.001) return;
    const direction = target.clone().sub(origin);
    const distance = clamp(
      direction.length(),
      Math.abs(l1 - l2) + 0.003,
      l1 + l2 - 0.003
    );
    direction.normalize();
    const cosine = clamp(
      (l1 * l1 + distance * distance - l2 * l2) / (2 * l1 * distance),
      -1,
      1
    );
    const bend = pole
      .clone()
      .addScaledVector(direction, -pole.dot(direction))
      .normalize();
    elbow
      .copy(origin)
      .addScaledVector(direction, cosine * l1)
      .addScaledVector(bend, Math.sqrt(1 - cosine * cosine) * l1);
    aim(a, b, elbow);
    aim(b, c, target);
  });
}
const ease = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Windup (0–.55s), release (.68s), follow-through, then return to cheering. */
export function poseHuman(
  h: Human,
  time: number,
  throwingAge = -1,
  flag = false
) {
  for (const [bone, rest] of h.rest) bone.quaternion.copy(rest);
  const active = throwingAge >= 0 && throwingAge < 1.45;
  const breath = Math.sin(time * 2.5) * 0.008;
  let wrist = vec(-0.34, 1.06 + breath, 0.27);
  const windup = vec(-0.39, 1.75, -0.28),
    release = vec(-0.2, 1.65, 0.49),
    follow = vec(0.17, 1.12, 0.49);
  if (active) {
    if (throwingAge < 0.48) wrist.lerp(windup, ease(throwingAge / 0.48));
    else if (throwingAge < 0.68)
      wrist.copy(windup).lerp(release, ease((throwingAge - 0.48) / 0.2));
    else if (throwingAge < 0.95)
      wrist.copy(release).lerp(follow, ease((throwingAge - 0.68) / 0.27));
    else
      wrist
        .copy(follow)
        .lerp(vec(-0.34, 1.06, 0.27), ease((throwingAge - 0.95) / 0.5));
  }
  for (const bone of h.bones.get('spine_02') || [])
    bone.quaternion.multiply(
      new T.Quaternion().setFromEuler(
        new T.Euler(
          active ? Math.sin(throwingAge * 4) * 0.12 : breath,
          active ? Math.sin(throwingAge * 4.5) * 0.2 : 0,
          0
        )
      )
    );
  h.root.updateWorldMatrix(true, true);
  const world = (v: T.Vector3) => h.root.localToWorld(v);
  const pole = (x: number, y: number, z: number) =>
    vec(x, y, z).transformDirection(h.root.matrixWorld);
  limb(
    h,
    ['upperarm_r', 'lowerarm_r', 'hand_r'],
    world(wrist),
    pole(-1, -0.3, 0)
  );
  limb(
    h,
    ['upperarm_l', 'lowerarm_l', 'hand_l'],
    world(
      flag
        ? vec(0.37, 1.55 + Math.sin(time * 3) * 0.07, 0.3)
        : vec(0.3, 1.1 + breath, 0.2)
    ),
    pole(1, -0.4, 0)
  );
  for (const [suffix, sign] of [
    ['l', 1],
    ['r', -1]
  ] as const)
    limb(
      h,
      [`thigh_${suffix}`, `calf_${suffix}`, `foot_${suffix}`],
      world(vec(sign * 0.15, 0.09, sign * 0.045)),
      pole(0, 0, 1)
    );
  const grip = active && throwingAge < 0.68 ? 0.75 : 0.22;
  for (const finger of ['index', 'middle', 'ring', 'pinky'])
    for (const joint of ['01', '02', '03'])
      for (const bone of h.bones.get(`${finger}_${joint}_r`) || [])
        bone.quaternion.multiply(
          new T.Quaternion().setFromAxisAngle(vec(0, 0, 1), grip)
        );
  h.root.updateWorldMatrix(true, true);
}

/** Bake the same posed GLB for distant instancing; no placeholder people. */
export function bakeHuman(
  h: Human
): { geometry: T.BufferGeometry; material: T.Material | T.Material[] }[] {
  poseHuman(h, 0);
  const parts: {
    geometry: T.BufferGeometry;
    material: T.Material | T.Material[];
  }[] = [];
  h.root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    if (o instanceof T.SkinnedMesh) o.skeleton.update();
    const geometry = o.geometry.clone(),
      p = geometry.attributes.position;
    const vertices = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const v = vec().fromBufferAttribute(p, i);
      if (o instanceof T.SkinnedMesh) o.applyBoneTransform(i, v);
      v.applyMatrix4(o.matrixWorld).toArray(vertices, i * 3);
    }
    geometry.setAttribute('position', new T.BufferAttribute(vertices, 3));
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();
    parts.push({ geometry, material: o.material });
  });
  return parts;
}
