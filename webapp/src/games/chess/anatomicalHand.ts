import * as THREE from 'three';

type Side = 'left' | 'right';
type Digit = 'Thumb' | 'Index' | 'Middle' | 'Ring' | 'Pinky';
export type HandBoneRig = Partial<
  Record<`${Side}${Digit}`, THREE.Bone[]> & Record<`${Side}Hand`, THREE.Bone>
>;
type Joint = {
  bone: THREE.Bone;
  bind: THREE.Quaternion;
  flexAxis: THREE.Vector3;
  spreadAxis: THREE.Vector3;
  oppositionAxis: THREE.Vector3;
  flex: number;
  spread: number;
  opposition: number;
  maxFlex: number;
  maxSpread: number;
  maxOpposition: number;
};
export type Finger = { thumb: boolean; chain: THREE.Bone[]; joints: Joint[] };
export type HandProfile = {
  hand: THREE.Bone;
  inward: THREE.Vector3;
  radial: THREE.Vector3;
  forward: THREE.Vector3;
  pinchAxis: THREE.Vector3;
  fingers: Partial<Record<Digit, Finger>>;
};
const profiles = new WeakMap<HandBoneRig, Partial<Record<Side, HandProfile>>>();
const terminalOffsets = new WeakMap<THREE.Bone, THREE.Vector3>();
const digits: Digit[] = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
const clamp = THREE.MathUtils.clamp;

export function tipPosition(chain: THREE.Bone[]) {
  const last = chain.at(-1);
  if (!last) return null;
  const child = last.children.find((node) => (node as THREE.Bone).isBone);
  if (child) return child.getWorldPosition(new THREE.Vector3());
  // The parent-frame segment direction must be converted to the distal frame;
  // a rolled bind bone does not necessarily point down its local Y axis.
  let direction = terminalOffsets.get(last);
  if (!direction) {
    direction = last.position
      .clone()
      .applyQuaternion(last.quaternion.clone().invert())
      .multiplyScalar(0.72);
    terminalOffsets.set(last, direction);
  }
  return last.localToWorld(direction.clone());
}

// Call once while the model is in its imported rest pose, before seated poses.
// Derive axes from geometry, never from an assumed Euler axis or world up.
export function calibrateHandRig(rig: HandBoneRig) {
  const cached = profiles.get(rig);
  if (cached) return cached;
  const result: Partial<Record<Side, HandProfile>> = {};
  for (const side of ['left', 'right'] as const) {
    const hand = rig[`${side}Hand`];
    const index = rig[`${side}Index`]?.[0];
    const middle = rig[`${side}Middle`]?.[0];
    const pinky = rig[`${side}Pinky`]?.[0];
    if (!hand || !index || !middle || !pinky) continue;
    hand.updateWorldMatrix(true, true);
    const origin = hand.getWorldPosition(new THREE.Vector3());
    const forward = middle
      .getWorldPosition(new THREE.Vector3())
      .sub(origin)
      .normalize();
    const radial = index
      .getWorldPosition(new THREE.Vector3())
      .sub(pinky.getWorldPosition(new THREE.Vector3()))
      .normalize();
    const inward = new THREE.Vector3()
      .crossVectors(radial, forward)
      .multiplyScalar(side === 'right' ? 1 : -1)
      .normalize();
    if (inward.lengthSq() < 0.5) continue;
    const inverseHand = hand
      .getWorldQuaternion(new THREE.Quaternion())
      .invert();
    const profile: HandProfile = {
      hand,
      inward: inward.clone().applyQuaternion(inverseHand),
      radial: radial.clone().applyQuaternion(inverseHand),
      forward: forward.clone().applyQuaternion(inverseHand),
      pinchAxis:
        rig[`${side}Thumb`]?.length === 3
          ? tipPosition(rig[`${side}Thumb`]!)!
              .sub(tipPosition(rig[`${side}Index`]!)!)
              .normalize()
              .applyQuaternion(inverseHand)
          : radial.clone().applyQuaternion(inverseHand),
      fingers: {}
    };
    for (const digit of digits) {
      const chain = rig[`${side}${digit}`];
      if (!chain || chain.length !== 3) continue;
      const thumb = digit === 'Thumb';
      const joints = chain.map((bone, i): Joint => {
        const next =
          chain[i + 1]?.getWorldPosition(new THREE.Vector3()) ||
          tipPosition(chain)!;
        const direction = next
          .sub(bone.getWorldPosition(new THREE.Vector3()))
          .normalize();
        const inverse = bone
          .getWorldQuaternion(new THREE.Quaternion())
          .invert();
        // Four fingers flex into the palm. The thumb flexes across it, with
        // a second, bounded opposition degree of freedom only at its base.
        const toward = thumb ? radial.clone().negate() : inward;
        return {
          bone,
          bind: bone.quaternion.clone().normalize(),
          flexAxis: new THREE.Vector3()
            .crossVectors(direction, toward)
            .normalize()
            .applyQuaternion(inverse),
          spreadAxis: inward.clone().applyQuaternion(inverse),
          oppositionAxis: new THREE.Vector3()
            .crossVectors(direction, inward)
            .normalize()
            .applyQuaternion(inverse),
          flex: 0,
          spread: 0,
          opposition: 0,
          // Conservative animation limits, measured from the imported pose.
          maxFlex: THREE.MathUtils.degToRad(
            (thumb ? [55, 65, 65] : [70, 90, 65])[i]
          ),
          maxSpread: !thumb && i === 0 ? THREE.MathUtils.degToRad(20) : 0,
          maxOpposition: thumb && i === 0 ? THREE.MathUtils.degToRad(35) : 0
        };
      });
      profile.fingers[digit] = { thumb, chain, joints };
    }
    result[side] = profile;
  }
  profiles.set(rig, result);
  return result;
}

function applyJoint(joint: Joint) {
  joint.flex = clamp(joint.flex, 0, joint.maxFlex);
  joint.spread = clamp(joint.spread, -joint.maxSpread, joint.maxSpread);
  joint.opposition = clamp(joint.opposition, 0, joint.maxOpposition);
  joint.bone.quaternion
    .copy(joint.bind)
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        joint.oppositionAxis,
        joint.opposition
      )
    )
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(joint.spreadAxis, joint.spread)
    )
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(joint.flexAxis, joint.flex)
    );
  joint.bone.updateWorldMatrix(false, true);
}

export function applyHandGrip(rig: HandBoneRig, side: Side, amount = 0) {
  const profile = profiles.get(rig)?.[side];
  if (!profile) return; // Do not guess axes on an uncalibrated/incomplete rig.
  const grip = clamp(amount, 0, 1);
  for (const digit of digits) {
    profile.fingers[digit]?.joints.forEach((joint, i) => {
      joint.flex =
        (digit === 'Thumb' ? [0.3, 0.3, 0.25] : [0.5, 0.8, 0.52])[i] * grip;
      joint.spread = 0;
      joint.opposition = digit === 'Thumb' && i === 0 ? 0.2 * grip : 0;
      applyJoint(joint);
    });
  }
}

export function applyFinger(finger: Finger) {
  // The distal joint follows the middle joint for a relaxed, continuous curl.
  // This excludes the sharp hooked fingertip that unconstrained CCD produced.
  if (!finger.thumb) finger.joints[2].flex = finger.joints[1].flex * 0.65;
  finger.joints.forEach(applyJoint);
}

// Bounded coordinate descent over anatomical degrees of freedom. Numerical
// steps include the coupled distal joint, so its motion cannot undo the PIP.
export function solveFingerContact(
  finger: Finger,
  target: THREE.Vector3,
  iterations = 24
) {
  applyFinger(finger);
  for (let iteration = 0; iteration < iterations; iteration++) {
    const step = 0.16 * Math.pow(0.82, iteration);
    for (let i = 0; i < finger.joints.length; i++) {
      const joint = finger.joints[i];
      for (const degree of ['flex', 'spread', 'opposition'] as const) {
        if (
          (!finger.thumb && i === 2) ||
          (degree === 'spread' && !joint.maxSpread) ||
          (degree === 'opposition' && !joint.maxOpposition)
        )
          continue;
        const original = joint[degree];
        let best = original;
        let error = tipPosition(finger.chain)!.distanceToSquared(target);
        for (const delta of [-step, step]) {
          joint[degree] = original + delta;
          applyFinger(finger);
          const candidate = tipPosition(finger.chain)!.distanceToSquared(
            target
          );
          if (candidate < error) {
            error = candidate;
            best = joint[degree];
          }
        }
        joint[degree] = best;
        applyFinger(finger);
      }
    }
  }
}

type JointPose = Pick<Joint, 'flex' | 'spread' | 'opposition'>;
export type PinchPose = {
  anchor: THREE.Vector3;
  fingers: { finger: Finger; pose: JointPose[] }[];
};

// Fit a single constrained grasp in hand space. Keeping this pose fixed during
// carry prevents target axes from flipping as fingertips cross or the seat turns.
export function createPinchPose(
  rig: HandBoneRig,
  radiusWorld: number,
  side: Side = 'right'
): PinchPose | undefined {
  const profile = profiles.get(rig)?.[side];
  if (!profile) return;
  const { hand, fingers } = profile;
  const grasp = [fingers.Thumb, fingers.Index, fingers.Middle].filter(
    (f): f is Finger => !!f
  );
  if (grasp.length !== 3) return;
  const all = Object.values(fingers);
  const saved = all.map((f) =>
    f.joints.map((j) => ({
      flex: j.flex,
      spread: j.spread,
      opposition: j.opposition
    }))
  );
  grasp.forEach((f) => {
    f.joints.forEach((j, i) => {
      j.flex = (f.thumb ? [0.2, 0.1, 0.1] : [0.35, 0.55, 0.3575])[i];
      j.spread = 0;
      j.opposition = f.thumb && i === 0 ? 0.05 : 0;
    });
    applyFinger(f);
  });
  const localTip = (f: Finger) => hand.worldToLocal(tipPosition(f.chain)!);
  const tips = grasp.map(localTip);
  const lateral = profile.pinchAxis.clone();
  const tangent = profile.forward.clone().projectOnPlane(lateral).normalize();
  const scale = hand.getWorldScale(new THREE.Vector3());
  // Targets represent the fingertip skeleton; leave room for the fleshy pad.
  const palmLength = profile.hand
    .worldToLocal(
      fingers.Middle!.chain[0].getWorldPosition(new THREE.Vector3())
    )
    .length();
  const radius =
    radiusWorld / Math.max(Math.abs(scale.x), 1e-6) + palmLength * 0.035;
  const offsets = [
    lateral.clone().multiplyScalar(radius),
    lateral.clone().multiplyScalar(-radius),
    lateral
      .clone()
      .multiplyScalar(-radius * 0.8)
      .addScaledVector(tangent, -radius * 0.6)
  ];
  const anchor = tips[0].clone().add(tips[1]).multiplyScalar(0.5);
  for (let iteration = 0; iteration < 16; iteration++) {
    grasp.forEach((finger, i) =>
      solveFingerContact(
        finger,
        hand.localToWorld(anchor.clone().add(offsets[i])),
        20
      )
    );
    // The thumb and index supply a precision pinch. The middle finger follows
    // within its limits; it must not pull the pinch away from those contacts.
    const next = localTip(grasp[0]).add(localTip(grasp[1])).multiplyScalar(0.5);
    anchor.lerp(next, 0.65);
  }
  const result = {
    anchor,
    fingers: grasp.map((finger) => ({
      finger,
      pose: finger.joints.map((j) => ({
        flex: j.flex,
        spread: j.spread,
        opposition: j.opposition
      }))
    }))
  };
  all.forEach((f, i) =>
    f.joints.forEach((joint, j) => {
      Object.assign(joint, saved[i][j]);
      applyJoint(joint);
    })
  );
  return result;
}

export function applyPinchPose(pinch: PinchPose, grip: number) {
  for (const { finger, pose } of pinch.fingers) {
    finger.joints.forEach((joint, i) => {
      joint.flex = pose[i].flex * grip;
      joint.spread = pose[i].spread * grip;
      joint.opposition = pose[i].opposition * grip;
      applyJoint(joint);
    });
  }
}
