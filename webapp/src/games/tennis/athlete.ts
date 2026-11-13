import * as THREE from 'three';
import { clamp, type MatchState, type Seat } from './engine';

type Rig = {
  model: THREE.Group;
  bones: Map<string, THREE.Bone>;
  rest: Map<THREE.Bone, THREE.Quaternion>;
  floorY: number;
};
const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function dressAthlete(model: THREE.Group, seat: Seat): Rig {
  const bounds = new THREE.Box3().setFromObject(model);
  const scale = (seat === 0 ? 1.87 : 1.8) / (bounds.max.y - bounds.min.y);
  model.scale.multiplyScalar(scale);
  model.position.y = -bounds.min.y * scale;
  model.updateMatrixWorld(true);
  const bones = new Map<string, THREE.Bone>();
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  let body: THREE.SkinnedMesh | undefined;
  model.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh && /superhero/i.test(o.name)) body = o;
  });
  if (!body) throw Error('Athlete body is missing');
  for (const bone of body.skeleton.bones) {
    bones.set(bone.name, bone);
    rest.set(bone, bone.quaternion.clone());
  }
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats)
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.roughness = 0.82;
        mat.metalness = 0;
        mat.envMapIntensity = 0.45;
      }
    // The hairstyle ships on a second skeleton. Bake its rest pose and attach
    // it to the athlete's head, so it follows the same tennis animation.
    if (/^Hair_/.test(mesh.name) && mesh instanceof THREE.SkinnedMesh) {
      mesh.skeleton.update();
      const geometry = mesh.geometry.clone(),
        positions = geometry.attributes.position;
      const vertices = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const p = vec().fromBufferAttribute(positions, i);
        mesh
          .applyBoneTransform(i, p)
          .applyMatrix4(mesh.matrixWorld)
          .toArray(vertices, i * 3);
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
      geometry.computeVertexNormals();
      const hair = new THREE.Mesh(geometry, mesh.material);
      hair.name = 'Tennis hair';
      hair.castShadow = true;
      // Vertices above are in world space; attach preserves their placement.
      const staging = new THREE.Group();
      staging.add(hair);
      staging.updateMatrixWorld(true);
      bones.get('Head')?.attach(hair);
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
  }
  body.skeleton.update();
  const geometry = body.geometry;
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const skin = new THREE.Color(seat === 0 ? '#c89470' : '#a97150');
  const shirt = new THREE.Color(seat === 0 ? '#e1eee6' : '#497cb6');
  const shorts = new THREE.Color(seat === 0 ? '#183f51' : '#273b47');
  const piping = new THREE.Color(seat === 0 ? '#437d81' : '#d7e3f2');
  const shoes = new THREE.Color('#eff0e5');
  const garment = new Uint8Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    const p = vec().fromBufferAttribute(positions, i);
    body.applyBoneTransform(i, p).applyMatrix4(body.matrixWorld);
    const y = p.y * (1.87 / (seat === 0 ? 1.87 : 1.8)),
      x = Math.abs(p.x);
    const top = y >= 1.04 && y < 1.66 && x < 0.49 && !(y > 1.6 && x < 0.105);
    const bottom = y > 0.68 && y < 1.045 && x < 0.37;
    garment[i] = top ? 1 : bottom ? 2 : y < 0.15 ? 3 : 0;
    const color =
      y < 0.15
        ? shoes
        : y < 0.28
          ? piping
          : bottom
            ? shorts
            : top
              ? y > 1.615 || y < 1.075 || (x > 0.24 && x < 0.28)
                ? piping
                : shirt
              : skin;
    // Slight weave variation keeps the kit matte rather than glossy plastic.
    const shade =
      top || bottom ? 0.975 + 0.025 * Math.sin(p.y * 170 + p.x * 83) : 1;
    colors[i * 3] = color.r * shade;
    colors[i * 3 + 1] = color.g * shade;
    colors[i * 3 + 2] = color.b * shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Skin stays smooth while the shirt and shorts read as opaque fabric.
  const old = Array.isArray(body.material) ? body.material : [body.material];
  body.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0
  });
  // Build a separate, relaxed fabric shell on the same skeleton. Smooth the
  // anatomical muscle/toe detail out of the kit; do not just paint bare skin.
  const index = geometry.index!;
  const skinFaces: number[] = [],
    clothFaces: number[] = [];
  const neighbors = Array.from(
    { length: positions.count },
    () => new Set<number>()
  );
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const dressed = ids.filter((id) => garment[id] > 0).length >= 2;
    (dressed ? clothFaces : skinFaces).push(...ids);
    if (dressed)
      for (const id of ids)
        for (const other of ids) if (id !== other) neighbors[id].add(other);
  }
  const clothGeometry = geometry.clone();
  let clothPositions = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++)
    vec()
      .fromBufferAttribute(positions, i)
      .toArray(clothPositions, i * 3);
  for (let pass = 0; pass < 4; pass++) {
    const next = clothPositions.slice();
    for (let i = 0; i < positions.count; i++) {
      const adjacent = [...neighbors[i]];
      if (
        !garment[i] ||
        adjacent.length < 3 ||
        adjacent.some((id) => garment[id] !== garment[i])
      )
        continue;
      for (let axis = 0; axis < 3; axis++)
        next[i * 3 + axis] =
          clothPositions[i * 3 + axis] * 0.55 +
          (adjacent.reduce(
            (sum, id) => sum + clothPositions[id * 3 + axis],
            0
          ) /
            adjacent.length) *
            0.45;
    }
    clothPositions = next;
  }
  const normal = geometry.attributes.normal,
    worldScale = body.getWorldScale(vec());
  for (let i = 0; i < positions.count; i++) {
    const ease = garment[i] === 2 ? 0.025 : 0.016;
    clothPositions[i * 3] += (normal.getX(i) * ease) / worldScale.x;
    clothPositions[i * 3 + 1] += (normal.getY(i) * ease) / worldScale.y;
    clothPositions[i * 3 + 2] += (normal.getZ(i) * ease) / worldScale.z;
  }
  clothGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(clothPositions, 3)
  );
  clothGeometry.setIndex(clothFaces);
  clothGeometry.computeVertexNormals();
  geometry.setIndex(skinFaces);
  const kit = body.clone(false);
  kit.name = 'Tennis shirt, shorts and shoes';
  kit.geometry = clothGeometry;
  kit.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.98
  });
  body.parent!.add(kit);
  old.forEach((material) => {
    if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose();
    material.dispose();
  });
  return { model, bones, rest, floorY: model.position.y };
}

function aimBone(
  rig: Rig,
  name: string,
  childName: string,
  target: THREE.Vector3
) {
  const bone = rig.bones.get(name),
    child = rig.bones.get(childName);
  if (!bone || !child || !bone.parent) return;
  bone.updateWorldMatrix(true, true);
  const origin = bone.getWorldPosition(vec());
  const from = child.getWorldPosition(vec()).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  if (!to.lengthSq()) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const parent = bone.parent
    .getWorldQuaternion(new THREE.Quaternion())
    .invert();
  bone.quaternion.copy(parent.multiply(delta.multiply(world)));
  bone.updateWorldMatrix(false, true);
}

/** Two-bone IK keeps elbows and knees articulated and the racket at the hand. */
function limb(
  rig: Rig,
  names: [string, string, string],
  target: THREE.Vector3,
  pole: THREE.Vector3
) {
  const [upper, lower, end] = names.map((name) => rig.bones.get(name));
  if (!upper || !lower || !end) return;
  const origin = upper.getWorldPosition(vec());
  const elbow = lower.getWorldPosition(vec());
  const l1 = origin.distanceTo(elbow),
    l2 = elbow.distanceTo(end.getWorldPosition(vec()));
  const dir = target.clone().sub(origin);
  const distance = clamp(
    dir.length(),
    Math.abs(l1 - l2) + 0.005,
    l1 + l2 - 0.005
  );
  dir.normalize();
  const cosine = clamp(
    (l1 * l1 + distance * distance - l2 * l2) / (2 * l1 * distance),
    -1,
    1
  );
  pole.addScaledVector(dir, -pole.dot(dir)).normalize();
  elbow
    .copy(origin)
    .addScaledVector(dir, cosine * l1)
    .addScaledVector(pole, Math.sqrt(1 - cosine * cosine) * l1);
  aimBone(rig, names[0], names[1], elbow);
  aimBone(rig, names[1], names[2], target);
}

export function poseAthlete(
  rig: Rig,
  root: THREE.Group,
  racket: THREE.Group,
  state: MatchState,
  seat: Seat,
  stride: number,
  speed: number,
  firstPerson = false
) {
  for (const [bone, q] of rig.rest) bone.quaternion.copy(q);
  const player = state.players[seat];
  const elapsed = state.time - player.swingAt;
  const hitting = elapsed >= 0 && elapsed < 0.55;
  const progress = hitting ? elapsed / 0.55 : 0;
  const toss = state.phase === 'toss' && state.score.server === seat;
  const serving = hitting && state.ball.serve && state.ball.last === seat;
  const moving = clamp(speed / 5, 0, 1);
  const step = Math.sin(stride) * moving;
  const breathe = Math.sin(state.time * 2.6) * 0.008;
  rig.model.position.y = rig.floorY - 0.075 + Math.abs(step) * 0.035 + breathe;
  const torso = rig.bones.get('spine_02');
  if (torso)
    torso.quaternion.multiply(
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          -0.08,
          hitting ? Math.sin(progress * Math.PI) * 0.38 : 0,
          0
        )
      )
    );
  root.updateWorldMatrix(true, true);
  const world = (x: number, y: number, z: number) =>
    root.localToWorld(vec(x, y, z));
  const pole = (x: number, y: number, z: number) =>
    vec(x, y, z).transformDirection(root.matrixWorld);
  for (const [suffix, sign] of [
    ['l', 1],
    ['r', -1]
  ] as const) {
    const phase = step * sign;
    limb(
      rig,
      [`thigh_${suffix}`, `calf_${suffix}`, `foot_${suffix}`],
      world(
        sign * (0.19 + moving * 0.04),
        0.105 + Math.max(0, phase) * 0.14,
        phase * 0.26
      ),
      pole(0, 0, 1)
    );
    // Keep each shoe planted through the stance half of the running cycle.
    aimBone(
      rig,
      `foot_${suffix}`,
      `ball_${suffix}`,
      world(sign * 0.19, 0.065 + Math.max(0, phase) * 0.14, 0.19 + phase * 0.26)
    );
  }
  let wrist = vec(-0.32, 1.13 + breathe, 0.34);
  if (toss) wrist.set(-0.36, 1.82, -0.16);
  else if (serving)
    wrist.set(
      -0.25,
      1.9 - progress * 0.7,
      0.18 + Math.sin(progress * Math.PI) * 0.4
    );
  else if (hitting)
    wrist.set(
      -0.51 + progress * 0.86,
      1.12 + Math.sin(progress * Math.PI) * 0.3,
      0.2 + Math.sin(progress * Math.PI) * 0.35
    );
  else if (player.queued > state.time) wrist.set(-0.5, 1.07, 0.08);
  limb(
    rig,
    ['upperarm_r', 'lowerarm_r', 'hand_r'],
    world(wrist.x, wrist.y, wrist.z),
    pole(-1, -0.5, 0)
  );
  limb(
    rig,
    ['upperarm_l', 'lowerarm_l', 'hand_l'],
    toss ? world(0.18, 1.92, 0.25) : world(0.28, 1.15 - step * 0.05, 0.3),
    pole(1, -0.4, 0)
  );
  // Wrap the fingers around the grip instead of leaving a flat open hand.
  for (const finger of ['index', 'middle', 'ring', 'pinky'])
    for (const joint of ['01', '02', '03']) {
      rig.bones
        .get(`${finger}_${joint}_r`)
        ?.quaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(vec(0, 0, 1), 0.75)
        );
    }
  root.updateWorldMatrix(true, true);
  const hand = rig.bones.get('hand_r');
  if (hand)
    racket.position.copy(root.worldToLocal(hand.getWorldPosition(vec())));
  const direction = toss
    ? vec(-0.25, 0.92, -0.3)
    : serving
      ? vec(0, 0.9 - progress, 0.5)
      : hitting
        ? vec(-0.85 + progress * 1.7, 0.3 + progress * 0.6, 0.12)
        : firstPerson
          ? vec(0.12, 0.78, 0.38)
          : vec(-0.65, 0.65, 0.25);
  racket.quaternion.setFromUnitVectors(vec(0, 1, 0), direction.normalize());
}

export function disposeAthlete(model: THREE.Object3D) {
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    if (o instanceof THREE.SkinnedMesh) o.skeleton.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v instanceof THREE.Texture) v.dispose();
      });
      m.dispose();
    });
  });
}
