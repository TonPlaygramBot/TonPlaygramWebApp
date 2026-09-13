import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
export const smoothContact = (t: number) => THREE.MathUtils.smoothstep(t, 0, 1);
export const worldPoint = (object: THREE.Object3D) => object.getWorldPosition(V());
type Side = 'right' | 'left';
type BonePose = { position: THREE.Vector3; quaternion: THREE.Quaternion };

function worldQuaternion(object: THREE.Object3D, quaternion: THREE.Quaternion) {
  object.quaternion.copy(object.parent!.getWorldQuaternion(Q()).invert().multiply(quaternion));
  object.updateWorldMatrix(false, true);
}
function pointBone(bone: THREE.Bone, child: THREE.Bone, point: THREE.Vector3) {
  const origin = worldPoint(bone);
  const from = worldPoint(child).sub(origin).normalize();
  const to = point.clone().sub(origin).normalize();
  worldQuaternion(bone, Q().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(Q())));
}

/** Snapshot the already seated pose. Never change the chair/root or stretch bones. */
export function createSnakeHumanInteraction(actor: THREE.Object3D) {
  const bones: THREE.Bone[] = [];
  const rest = new Map<THREE.Bone, BonePose>();
  actor.traverse(object => {
    if (!(object as THREE.Bone).isBone) return;
    const bone = object as THREE.Bone;
    bones.push(bone);
    rest.set(bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });
  });
  const find = (...names: string[]) => names.map(name => bones.find(bone =>
    bone.name.toLowerCase().replace(/[^a-z0-9]/g, '').endsWith(name))).find(Boolean);
  const spine = find('spine', 'spine1');
  const hips = find('hips', 'pelvis');
  const legs = ['right', 'left'].map(side => ({
    upper: find(`${side}upleg`, `${side}thigh`), lower: find(`${side}leg`, `${side}calf`), foot: find(`${side}foot`)
  })).filter(leg => leg.upper && leg.lower && leg.foot);
  const arms = Object.fromEntries((['right', 'left'] as Side[]).map(side => {
    const hand = find(`${side}hand`);
    const upper = find(`${side}arm`, `${side}upperarm`);
    const lower = find(`${side}forearm`, `${side}lowerarm`);
    const fingers = Object.fromEntries(['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].map(name => [name,
      [1, 2, 3].map(index => find(`${side}hand${name.toLowerCase()}${index}`, `${side}${name.toLowerCase()}${index}`)).filter(Boolean)
    ])) as Record<string, THREE.Bone[]>;
    if (!hand || !upper || !lower || !fingers.Middle.length) return [side, null];
    const palm = new THREE.Object3D(); palm.name = `snake-${side}-palm`;
    palm.position.copy(hand.worldToLocal(worldPoint(fingers.Middle[0]))).multiplyScalar(0.76);
    hand.add(palm);
    const fingerAxis = fingers.Middle[0].position.clone().normalize();
    const radial = hand.worldToLocal(worldPoint(fingers.Index[0])).sub(hand.worldToLocal(worldPoint(fingers.Pinky[0])));
    radial.addScaledVector(fingerAxis, -radial.dot(fingerAxis)).normalize();
    const normal = radial.clone().cross(fingerAxis);
    // Contact is in the grasp volume above the palm skin, not inside the wrist.
    palm.position.addScaledVector(normal, (side === 'right' ? -1 : 1) * palm.position.length() * 0.3);
    const basis = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(radial, fingerAxis, normal));
    return [side, { hand, upper, lower, palm, fingers, basis }];
  }));
  if (!arms.right || !arms.left) {
    Object.values(arms).forEach(arm => arm?.palm.removeFromParent());
    return null;
  }
  const reset = () => {
    rest.forEach((pose, bone) => { bone.position.copy(pose.position); bone.quaternion.copy(pose.quaternion); });
    actor.updateWorldMatrix(true, true);
  };
  const unit = worldPoint(arms.right.upper).distanceTo(worldPoint(arms.right.lower)) +
    worldPoint(arms.right.lower).distanceTo(worldPoint(arms.right.hand));
  const forward = V(0, 0, 1).applyQuaternion(actor.parent!.getWorldQuaternion(Q())).normalize();
  const grip = (side: Side, amount: number, trigger = false) => {
    const arm = arms[side];
    const handWorld = arm.hand.getWorldQuaternion(Q());
    const radial = V(1, 0, 0).applyQuaternion(arm.basis).applyQuaternion(handWorld);
    const fingerDirection = V(0, 1, 0).applyQuaternion(arm.basis).applyQuaternion(handWorld);
    const sign = side === 'right' ? -1 : 1;
    Object.entries(arm.fingers).forEach(([name, chain]) => {
      chain.forEach((bone, index) => {
        const amountClamped = THREE.MathUtils.clamp(amount, 0, 1);
        const curl = name === 'Thumb' ? (index ? 0.48 : 0.25)
          : name === 'Index' && trigger ? (index ? 0.62 : 0.2) : (index ? 1.12 : 0.9);
        // Ludo's finger pattern, expressed in the palm basis rather than assuming
        // every imported finger flexes around its local X axis.
        const q = Q().setFromAxisAngle(radial, sign * curl * amountClamped).multiply(bone.getWorldQuaternion(Q()));
        if (name === 'Thumb' && index === 0) q.premultiply(Q().setFromAxisAngle(fingerDirection, sign * 0.6 * amountClamped));
        worldQuaternion(bone, q);
      });
    });
  };
  const fingertip = (side: Side, name: string) => {
    const chain = arms[side].fingers[name], last = chain[chain.length - 1];
    // The skin extends beyond the terminal joint; use an anatomical distal tip.
    return last.localToWorld(last.position.clone().multiplyScalar(0.72));
  };
  const dieContactTarget = (cube: THREE.Object3D, tip: THREE.Vector3) => {
    const scale = cube.getWorldScale(V());
    const half = Number(cube.userData.gripHalfExtent) || unit * 0.04 / Math.max(scale.x, scale.y, scale.z);
    const local = cube.worldToLocal(tip.clone());
    const surface = local.clone().clampScalar(-half, half);
    // Pinch the sides above the tabletop, rather than curling under the cube.
    const axes = ['x', 'y', 'z'] as const;
    const up = V(0, 1, 0).applyQuaternion(cube.getWorldQuaternion(Q()).invert());
    const vertical = axes.reduce((a, b) => Math.abs(up[a]) > Math.abs(up[b]) ? a : b);
    const sign = up[vertical] < 0 ? -1 : 1;
    const sides = axes.filter(axis => axis !== vertical);
    const axis = Math.abs(local[sides[0]]) > Math.abs(local[sides[1]]) ? sides[0] : sides[1];
    surface[axis] = (local[axis] < 0 ? -1 : 1) * half;
    surface[vertical] = sign * THREE.MathUtils.clamp(sign * surface[vertical], -half * 0.1, half * 0.8);
    return cube.localToWorld(surface);
  };
  const conformGrip = (side: Side, center: THREE.Vector3, axis: THREE.Vector3, radius: number, amount: number, trigger?: THREE.Vector3, cube?: THREE.Object3D) => {
    const arm = arms[side];
    const flexAxis = V(1, 0, 0).applyQuaternion(arm.basis).applyQuaternion(arm.hand.getWorldQuaternion(Q())).normalize();
    for (const name of ['Index', 'Middle', 'Ring', 'Pinky']) {
      const chain = arm.fingers[name];
      const tip = fingertip(side, name), delta = tip.clone().sub(center);
      const projected = center.clone().addScaledVector(axis, delta.dot(axis));
      const radial = tip.clone().sub(projected).normalize();
      let target = name === 'Index' && trigger ? trigger.clone() : projected.addScaledVector(radial, radius + unit * 0.006);
      if (cube) target = dieContactTarget(cube, tip);
      // One flexion axis per joint prevents sideways knuckle kinks. Limit each
      // correction and preserve authored bone lengths and the anchored palm.
      const flexion = new Map<THREE.Bone, number>();
      for (let iteration = 0; iteration < 5; iteration++) {
        for (let i = chain.length - 1; i >= 0; i--) {
          const bone = chain[i], origin = worldPoint(bone);
          const from = fingertip(side, name).sub(origin), to = target.clone().sub(origin);
          from.addScaledVector(flexAxis, -from.dot(flexAxis)).normalize();
          to.addScaledVector(flexAxis, -to.dot(flexAxis)).normalize();
          const angle = Math.atan2(flexAxis.dot(from.clone().cross(to)), from.dot(to));
          const sign = side === 'right' ? -1 : 1;
          const baseCurl = (name === 'Index' && trigger ? i ? 0.62 : 0.2 : i ? 1.12 : 0.9) * amount;
          const prior = flexion.get(bone) ?? baseCurl;
          const next = THREE.MathUtils.clamp(prior + sign * THREE.MathUtils.clamp(angle, -0.12, 0.12) * THREE.MathUtils.clamp(amount, 0, 1), 0, 1.55);
          const correction = (next - prior) * sign; flexion.set(bone, next);
          worldQuaternion(bone, Q().setFromAxisAngle(flexAxis, correction).multiply(bone.getWorldQuaternion(Q())));
        }
      }
    }
  };
  const conformDie = (side: Side, die: THREE.Object3D, amount: number) => {
    const axis = V(1, 0, 0).applyQuaternion(arms[side].basis).applyQuaternion(arms[side].hand.getWorldQuaternion(Q()));
    conformGrip(side, worldPoint(die), axis, 0, amount, undefined, die);
    // A small MCP spread adjustment lets the index and middle fingers form a
    // pinch around a small cube without bending their distal joints sideways.
    const spreadAxis = V(0, 0, 1).applyQuaternion(arms[side].basis).applyQuaternion(arms[side].hand.getWorldQuaternion(Q()));
    for (const name of ['Index', 'Middle']) {
      const bone = arms[side].fingers[name][0], target = dieContactTarget(die, fingertip(side, name));
      for (let i = 0; i < 4; i++) {
        const origin = worldPoint(bone), from = fingertip(side, name).sub(origin), to = target.clone().sub(origin);
        from.addScaledVector(spreadAxis, -from.dot(spreadAxis)).normalize();
        to.addScaledVector(spreadAxis, -to.dot(spreadAxis)).normalize();
        const angle = Math.atan2(spreadAxis.dot(from.clone().cross(to)), from.dot(to));
        worldQuaternion(bone, Q().setFromAxisAngle(spreadAxis, THREE.MathUtils.clamp(angle, -0.07, 0.07) * amount).multiply(bone.getWorldQuaternion(Q())));
      }
    }
    // The thumb opposes the fingers on the actual die surface. Its saddle joint
    // has an opposition axis that differs from the four finger flexion axes.
    const target = dieContactTarget(die, fingertip(side, 'Thumb'));
    const chain = arms[side].fingers.Thumb;
    for (let iteration = 0; iteration < 6; iteration++) for (let i = chain.length - 1; i >= 0; i--) {
      const bone = chain[i], origin = worldPoint(bone);
      const from = fingertip(side, 'Thumb').sub(origin).normalize(), to = target.clone().sub(origin).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(from.dot(to), -1, 1));
      if (angle < 1e-5) continue;
      const rotation = Q().setFromUnitVectors(from, to);
      rotation.slerp(Q(), 1 - Math.min(1, 0.1 / angle) * THREE.MathUtils.clamp(amount, 0, 1));
      worldQuaternion(bone, rotation.multiply(bone.getWorldQuaternion(Q())));
    }
  };
  const orientation = (side: Side, radial: THREE.Vector3, fingers: THREE.Vector3) => {
    const y = fingers.clone().normalize();
    const x = radial.clone().addScaledVector(y, -radial.dot(y)).normalize();
    return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y)))
      .multiply(arms[side].basis.clone().invert()).normalize();
  };
  const reach = (side: Side, target: THREE.Vector3, handQ: THREE.Quaternion, lean = true) => {
    const { upper, lower, hand, palm } = arms[side];
    const wrist = target.clone().sub(palm.position.clone().multiply(hand.getWorldScale(V())).applyQuaternion(handQ));
    const a = worldPoint(upper).distanceTo(worldPoint(lower)), b = worldPoint(lower).distanceTo(worldPoint(hand));
    if (lean && spine) {
      // Rotate the torso around its seated pivot if the object is beyond arm reach.
      // The palm target is always the real object location, including rotated seats.
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const excess = worldPoint(upper).distanceTo(wrist) - (a + b) * 0.985;
        if (excess <= 0 || total >= 1.15) break;
        const direction = wrist.clone().sub(worldPoint(upper)); direction.y = 0; direction.normalize();
        const angle = Math.min(1.15 - total, excess / Math.max(unit * 0.6, 0.01));
        worldQuaternion(spine, Q().setFromAxisAngle(V(0, 1, 0).cross(direction).normalize(), angle).multiply(spine.getWorldQuaternion(Q())));
        total += angle;
      }
      if (hips) {
        // A legacy parking slot may require a seated weight shift. Dice
        // pickups disable this fallback. Keep both
        // feet planted; neither the die, chair nor limb lengths are relocated.
        const planted = legs.map(leg => ({ ...leg, target: worldPoint(leg.foot!), q: leg.foot!.getWorldQuaternion(Q()), knee: worldPoint(leg.lower!) }));
        const excess = Math.max(0, worldPoint(upper).distanceTo(wrist) - (a + b) * 0.985);
        const shift = wrist.clone().sub(worldPoint(upper)); shift.y = 0; shift.normalize().multiplyScalar(Math.min(unit * 0.4, excess * 1.15));
        if (shift.lengthSq() > 0) {
          const origin = worldPoint(hips), parent = hips.parent!;
          hips.position.add(parent.worldToLocal(origin.clone().add(shift)).sub(parent.worldToLocal(origin.clone())));
          hips.updateWorldMatrix(false, true);
          for (const leg of planted) {
            const thigh = leg.upper!, shin = leg.lower!, foot = leg.foot!;
            const hip = worldPoint(thigh), knee = worldPoint(shin), ankle = worldPoint(foot);
            const upperLength = hip.distanceTo(knee), lowerLength = knee.distanceTo(ankle);
            const direction = leg.target.clone().sub(hip);
            const distance = THREE.MathUtils.clamp(direction.length(), Math.abs(upperLength - lowerLength) + 1e-5, upperLength + lowerLength - 1e-5);
            direction.normalize();
            const pole = leg.knee.clone().sub(hip).addScaledVector(direction, -leg.knee.clone().sub(hip).dot(direction)).normalize();
            const projection = (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * distance);
            pointBone(thigh, shin, hip.clone().addScaledVector(direction, projection).addScaledVector(pole, Math.sqrt(Math.max(0, upperLength ** 2 - projection ** 2))));
            pointBone(shin, foot, leg.target); worldQuaternion(foot, leg.q);
          }
        }
      }
    }
    const shoulder = worldPoint(upper), aim = wrist.clone().sub(shoulder);
    const d = THREE.MathUtils.clamp(aim.length(), Math.abs(a - b) + unit * 1e-5, a + b - unit * 1e-5);
    aim.normalize();
    const bend = V(side === 'right' ? -0.16 : 0.16, -1, -0.1).applyQuaternion(actor.parent!.getWorldQuaternion(Q()));
    bend.addScaledVector(aim, -bend.dot(aim)).normalize();
    const along = (a * a + d * d - b * b) / (2 * d);
    pointBone(upper, lower, shoulder.clone().addScaledVector(aim, along).addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along))));
    pointBone(lower, hand, shoulder.clone().addScaledVector(aim, d));
    worldQuaternion(hand, handQ);
    return worldPoint(palm).distanceTo(target);
  };
  // Rest the forearms over the lap instead of restoring the legacy outstretched
  // arm pose after each action. Preserve the original seated lower body.
  for (const side of ['right', 'left'] as Side[]) {
    const arm = arms[side];
    const target = worldPoint(arm.upper).addScaledVector(forward, unit * 0.3).add(V(0, -unit * 0.76, 0));
    const radial = worldPoint(arms[side === 'right' ? 'left' : 'right'].upper).sub(worldPoint(arm.upper)).normalize();
    reach(side, target, orientation(side, radial, forward), false);
    for (const bone of [arm.upper, arm.lower, arm.hand]) rest.set(bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });
  }
  return { actor, arms, unit, forward, reset, grip, conformGrip, conformDie, fingertip, orientation, reach,
    dispose() { reset(); arms.right.palm.removeFromParent(); arms.left.palm.removeFromParent(); } };
}
export type SnakeHuman = NonNullable<ReturnType<typeof createSnakeHumanInteraction>>;
