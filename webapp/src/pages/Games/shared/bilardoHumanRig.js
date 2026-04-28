import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const Y_AXIS = UP;
const BASIS_MAT = new THREE.Matrix4();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);

const cleanName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(
    side.clone().normalize(),
    up.clone().normalize(),
    forward.clone().normalize()
  );
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function findBone(bones, names) {
  const list = bones.map((bone) => ({ bone, name: cleanName(bone.name) }));
  for (const alias of names) {
    const exact = list.find((x) => x.name === alias || x.name.endsWith(alias));
    if (exact) return exact.bone;
  }
  for (const alias of names) {
    const loose = list.find((x) => x.name.includes(alias));
    if (loose) return loose.bone;
  }
  return undefined;
}

function buildAvatarBones(model) {
  const all = [];
  model.traverse((obj) => {
    if (obj?.isBone) all.push(obj);
  });
  const f = (...names) => findBone(all, names);
  return {
    hips: f('hips', 'pelvis', 'mixamorigHips'),
    spine: f('spine', 'spine01', 'mixamorigSpine'),
    chest: f('spine2', 'chest', 'upperchest', 'mixamorigSpine2', 'mixamorigSpine1'),
    neck: f('neck', 'mixamorigNeck'),
    head: f('head', 'mixamorigHead'),
    leftUpperArm: f('leftupperarm', 'leftarm', 'upperarml', 'mixamorigLeftArm'),
    leftLowerArm: f('leftforearm', 'leftlowerarm', 'forearml', 'mixamorigLeftForeArm'),
    leftHand: f('lefthand', 'handl', 'mixamorigLeftHand'),
    rightUpperArm: f('rightupperarm', 'rightarm', 'upperarmr', 'mixamorigRightArm'),
    rightLowerArm: f('rightforearm', 'rightlowerarm', 'forearmr', 'mixamorigRightForeArm'),
    rightHand: f('righthand', 'handr', 'mixamorigRightHand'),
    leftUpperLeg: f('leftupleg', 'leftupperleg', 'leftthigh', 'mixamorigLeftUpLeg'),
    leftLowerLeg: f('leftleg', 'leftlowerleg', 'leftcalf', 'mixamorigLeftLeg'),
    leftFoot: f('leftfoot', 'footl', 'mixamorigLeftFoot'),
    rightUpperLeg: f('rightupleg', 'rightupperleg', 'rightthigh', 'mixamorigRightUpLeg'),
    rightLowerLeg: f('rightleg', 'rightlowerleg', 'rightcalf', 'mixamorigRightLeg'),
    rightFoot: f('rightfoot', 'footr', 'mixamorigRightFoot')
  };
}

function collectFingerBones(hand) {
  const out = [];
  hand?.traverse((obj) => {
    if (!obj?.isBone || obj === hand) return;
    const n = cleanName(obj.name);
    if (['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'].some((s) => n.includes(s))) {
      out.push(obj);
    }
  });
  return out;
}

function createFallbackHuman() {
  const group = new THREE.Group();
  const gray = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.05 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c9a5, roughness: 0.8, metalness: 0 });
  const addBox = (size, pos, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    group.add(mesh);
  };
  addBox([0.42, 0.72, 0.22], [0, 1.18, 0], gray);
  addBox([0.14, 0.9, 0.14], [-0.09, 0.45, 0], gray);
  addBox([0.14, 0.9, 0.14], [0.09, 0.45, 0], gray);
  addBox([0.12, 0.72, 0.12], [-0.31, 1.18, 0], gray);
  addBox([0.12, 0.72, 0.12], [0.31, 1.18, 0], gray);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), skin);
  head.position.set(0, 1.7, 0);
  group.add(head);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

function normalizeHuman(model, opts) {
  const scale = opts?.humanScale ?? 1.18;
  const yawFix = opts?.humanVisualYawFix ?? Math.PI;
  model.scale.setScalar(scale);
  model.rotation.set(0, yawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function stabilizeGltfMaterial(material, textureAnisotropy) {
  if (!material) return;
  const maps = [
    material.map,
    material.emissiveMap,
    material.normalMap,
    material.roughnessMap,
    material.metalnessMap,
    material.alphaMap
  ];
  maps.forEach((texture) => {
    if (!texture) return;
    if (Number.isFinite(textureAnisotropy)) {
      texture.anisotropy = Math.max(1, textureAnisotropy);
    }
    texture.needsUpdate = true;
  });
  material.needsUpdate = true;
}

function pickAnimationClip(clips, pattern) {
  if (!Array.isArray(clips) || clips.length === 0) return null;
  const found = clips.find((clip) => pattern.test(String(clip?.name || '')));
  return found || null;
}

function setActiveAction(human, actionName, fadeSeconds = 0.2) {
  if (!human?.actions) return;
  if (human.activeActionName === actionName) return;
  const next = human.actions[actionName];
  if (!next) return;
  const prev = human.activeActionName ? human.actions[human.activeActionName] : null;
  if (prev && prev !== next) {
    prev.fadeOut(fadeSeconds);
  }
  next.reset().fadeIn(fadeSeconds).play();
  human.activeActionName = actionName;
}

function updateClipDrivenHuman(human, dt, frame, mode = 'idle') {
  if (!human?.mixer || !human?.activeGlb || !human?.modelRoot) return false;
  if (mode === 'walk' && human.actions?.walk) {
    setActiveAction(human, 'walk', 0.22);
    human.actions.walk.timeScale = 1;
  } else if (human.actions?.idle) {
    setActiveAction(human, 'idle', 0.24);
  }
  human.fallback.visible = false;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  human.mixer.update(Math.max(0, dt));
  return true;
}

export function createBilardoHumanRig(scene, opts = {}) {
  const textureAnisotropy = Number.isFinite(opts?.textureAnisotropy)
    ? Math.max(1, opts.textureAnisotropy)
    : null;
  const human = {
    root: new THREE.Group(),
    modelRoot: new THREE.Group(),
    model: null,
    fallback: createFallbackHuman(),
    bones: {},
    leftFingers: [],
    rightFingers: [],
    restQuats: new Map(),
    loaded: false,
    activeGlb: false,
    poseT: 0,
    walkT: 0,
    yaw: 0,
    breathT: 0,
    settleT: 0,
    strikeRoot: new THREE.Vector3(),
    strikeYaw: 0,
    strikeClock: 0,
    mixer: null,
    actions: null,
    activeActionName: null,
    clipDrivenWalkEnabled: false,
    cfg: {
      poseLambda: opts.poseLambda ?? 9,
      moveLambda: opts.moveLambda ?? 5.6,
      rotLambda: opts.rotLambda ?? 8.5,
      strikeTime: opts.strikeTime ?? 0.11,
      holdTime: opts.holdTime ?? 0.05,
      stanceWidth: opts.stanceWidth ?? 0.52,
      bridgePalmTableLift: opts.bridgePalmTableLift ?? 0.012,
      chinToCueHeight: opts.chinToCueHeight ?? 0.11,
      cueArmElbowRise: opts.cueArmElbowRise ?? 0.43,
      tableTopY: opts.tableTopY ?? 0.84
    }
  };

  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot, human.fallback);

  const loader = opts.loader;
  const modelUrl = opts.modelUrl;
  if (!loader || !modelUrl) {
    human.loaded = true;
    human.fallback.visible = true;
    return human;
  }

  loader.setCrossOrigin?.('anonymous');
  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf?.scene || gltf?.scenes?.[0];
      if (!model) {
        human.loaded = true;
        human.fallback.visible = true;
        return;
      }
      normalizeHuman(model, opts);
      const clips = Array.isArray(gltf?.animations) ? gltf.animations : [];
      model.traverse((obj) => {
        if (!obj?.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        const mats = Array.isArray(obj.material)
          ? obj.material
          : obj.material
            ? [obj.material]
            : [];
        mats.forEach((m) => {
          stabilizeGltfMaterial(m, textureAnisotropy);
        });
      });
      human.bones = buildAvatarBones(model);
      human.leftFingers = collectFingerBones(human.bones.leftHand);
      human.rightFingers = collectFingerBones(human.bones.rightHand);
      [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => {
        if (bone) human.restQuats.set(bone, bone.quaternion.clone());
      });
      human.activeGlb = Boolean(
        human.bones.hips &&
          human.bones.spine &&
          human.bones.head &&
          human.bones.leftUpperArm &&
          human.bones.leftLowerArm &&
          human.bones.leftHand &&
          human.bones.rightUpperArm &&
          human.bones.rightLowerArm &&
          human.bones.rightHand &&
          human.bones.leftUpperLeg &&
          human.bones.leftLowerLeg &&
          human.bones.rightUpperLeg &&
          human.bones.rightLowerLeg
      );
      human.model = model;
      human.modelRoot.add(model);
      human.modelRoot.visible = human.activeGlb;
      human.fallback.visible = !human.activeGlb;
      if (human.activeGlb && clips.length > 0) {
        const walkClip = pickAnimationClip(clips, /(walk|walking)/i) || clips[0];
        const idleClip = pickAnimationClip(clips, /(idle|stand|pose)/i);
        human.mixer = new THREE.AnimationMixer(model);
        human.actions = {
          walk: walkClip ? human.mixer.clipAction(walkClip) : null,
          idle: idleClip ? human.mixer.clipAction(idleClip) : null
        };
        if (!human.actions.idle && human.actions.walk) {
          human.actions.idle = human.actions.walk;
        }
        human.clipDrivenWalkEnabled = Boolean(human.actions.walk || human.actions.idle);
        if (human.clipDrivenWalkEnabled && human.actions.idle) {
          human.actions.idle.play();
          human.activeActionName = 'idle';
        }
      }
      human.loaded = true;
    },
    undefined,
    () => {
      human.loaded = true;
      human.activeGlb = false;
      human.modelRoot.visible = false;
      human.fallback.visible = true;
      human.mixer = null;
      human.actions = null;
      human.activeActionName = null;
    }
  );

  return human;
}

function setBoneWorldQuaternion(bone, q) {
  if (!bone || !q) return;
  const parentQ = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentQ);
  bone.quaternion.copy(parentQ.invert().multiply(q));
  bone.updateMatrixWorld(true);
}

function firstBoneChild(bone) {
  return bone?.children.find((child) => child?.isBone);
}

function rotateBoneToward(bone, target, strength = 1, fallbackDir = UP) {
  if (!bone || strength <= 0) return;
  const bonePos = bone.getWorldPosition(new THREE.Vector3());
  const childPos =
    firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) ||
    bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()),
    clamp01(strength)
  );
  setBoneWorldQuaternion(
    bone,
    delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
  );
}

function twistBone(bone, axis, amount) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(
    bone,
    new THREE.Quaternion()
      .setFromAxisAngle(axis.clone().normalize(), amount)
      .multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
  );
}

function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 2; i += 1) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
    twistBone(upper, pole, 0.025 * upperStrength);
  }
}

function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) {
    q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  }
  setBoneWorldQuaternion(
    bone,
    bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength))
  );
}

function poseFingers(fingers, mode, weight) {
  const w = clamp01(weight);
  fingers.forEach((finger, i) => {
    const n = cleanName(finger.name);
    const thumb = n.includes('thumb');
    const index = n.includes('index');
    const middle = n.includes('middle');
    const ring = n.includes('ring');
    const pinky = n.includes('pinky') || n.includes('little');
    const base = !(n.includes('2') || n.includes('3') || n.includes('intermediate') || n.includes('distal'));
    const tip = n.includes('3') || n.includes('distal');
    if (mode === 'idle') {
      finger.rotation.x += 0.02 * w;
      finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1);
      return;
    }
    if (mode === 'grip') {
      if (thumb) {
        finger.rotation.x += 0.22 * w;
        finger.rotation.y += -0.42 * w;
        finger.rotation.z += 0.22 * w;
        return;
      }
      const curl = index
        ? base
          ? 0.42
          : tip
            ? 0.48
            : 0.62
        : middle
          ? base
            ? 0.54
            : tip
              ? 0.58
              : 0.78
          : ring
            ? base
              ? 0.48
              : tip
                ? 0.52
                : 0.68
            : pinky
              ? base
                ? 0.42
                : tip
                  ? 0.46
                  : 0.6
              : 0;
      finger.rotation.x += curl * w;
      finger.rotation.z += (index ? -0.03 : ring ? 0.04 : pinky ? 0.07 : 0) * w;
      return;
    }
    if (thumb) {
      finger.rotation.x += -0.04 * w;
      finger.rotation.y += 0.62 * w;
      finger.rotation.z += -0.58 * w;
    } else if (index) {
      finger.rotation.x += (base ? 0.12 : tip ? 0.22 : 0.28) * w;
      finger.rotation.y += -0.26 * w;
      finger.rotation.z += -0.2 * w;
    } else if (middle) {
      finger.rotation.x += (base ? 0.1 : tip ? 0.18 : 0.22) * w;
      finger.rotation.y += -0.04 * w;
      finger.rotation.z += -0.04 * w;
    } else if (ring || pinky) {
      finger.rotation.x +=
        (base ? (ring ? 0.03 : 0.02) : tip ? (ring ? 0.1 : 0.08) : ring ? 0.12 : 0.1) * w;
      finger.rotation.y += (ring ? 0.08 : 0.16) * w;
      finger.rotation.z += (ring ? 0.16 : 0.28) * w;
    }
  });
}

function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) {
    human.fallback.visible = true;
    human.fallback.position.copy(frame.rootWorld);
    human.fallback.rotation.y = human.yaw;
    human.fallback.rotation.x = -0.16 * frame.t;
    human.fallback.position.y -= 0.035 * frame.t;
    return;
  }

  human.fallback.visible = false;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.position.y += 0.006 * frame.breath - 0.018 * frame.t;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);

  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);

  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2);
    const c = Math.cos(human.walkT * 6.2);
    const w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.34 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.34 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.28 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.28 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.23 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.23 * w;
    if (b.spine) b.spine.rotation.z += c * 0.025 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.018 * w;
  }

  const rightGrip = frame.rightHandWorld
    .clone()
    .addScaledVector(cueDir, -0.028 * (0.25 + 0.75 * ik))
    .addScaledVector(UP, 0.006 * ik);
  const rightIdleElbow = rightGrip
    .clone()
    .addScaledVector(UP, 0.24 + 0.19 * ik)
    .addScaledVector(frame.side, 0.09)
    .addScaledVector(frame.forward, -0.03 * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.68);
  const rightHold = 0.56 + 0.4 * ik;

  aimTwoBone(
    b.rightUpperArm,
    b.rightLowerArm,
    rightElbow,
    rightGrip,
    frame.side.clone().addScaledVector(UP, 0.22).normalize(),
    rightHold,
    rightHold
  );
  setHandBasis(
    b.rightHand,
    frame.side.clone().addScaledVector(UP, -0.08).normalize(),
    UP.clone().multiplyScalar(0.76).addScaledVector(frame.side, 0.18).addScaledVector(frame.forward, -0.1).normalize(),
    cueDir,
    0.08 * idle + 0.2 * ik + 0.03 * frame.stroke,
    0.78 + 0.18 * ik
  );
  poseFingers(human.rightFingers, 'grip', 0.58 + 0.28 * ik);

  if (ik < 0.025) {
    poseFingers(human.leftFingers, 'idle', 1);
    return;
  }

  rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.16 + 0.44 * ik) * ik, frame.forward);
  twistBone(b.hips, frame.side, -0.075 * ik);
  twistBone(b.hips, frame.forward, -0.04 * ik);
  rotateBoneToward(b.spine, frame.chestCenterWorld, (0.38 + 0.36 * ik) * ik, frame.forward);
  twistBone(b.spine, frame.side, -0.23 * ik);
  twistBone(b.spine, frame.forward, -0.055 * ik);
  rotateBoneToward(b.chest, frame.neckWorld, (0.52 + 0.3 * ik) * ik, frame.forward);
  twistBone(b.chest, frame.side, -0.35 * ik);
  twistBone(b.chest, frame.forward, -0.035 * ik);
  rotateBoneToward(b.neck, frame.headCenterWorld, 0.66 * ik, frame.forward);
  twistBone(b.neck, frame.side, -0.13 * ik);
  setBoneWorldQuaternion(
    b.head,
    b.head
      ? b.head
          .getWorldQuaternion(new THREE.Quaternion())
          .slerp(
            shotQ
              .clone()
              .multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik))
              .multiply(new THREE.Quaternion().setFromAxisAngle(frame.forward, -0.025 * ik)),
            0.74 * ik
          )
      : shotQ
  );

  const leftHand = frame.leftHandWorld
    .clone()
    .addScaledVector(frame.forward, 0.012 * ik)
    .addScaledVector(frame.side, -0.006 * ik)
    .addScaledVector(UP, -0.01 * ik);
  const leftElbow = frame.leftElbow
    .clone()
    .addScaledVector(frame.forward, 0.02 * ik)
    .addScaledVector(frame.side, -0.03 * ik)
    .addScaledVector(UP, -0.005 * ik);
  aimTwoBone(
    b.leftUpperArm,
    b.leftLowerArm,
    leftElbow,
    leftHand,
    frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.14).normalize(),
    0.95 * ik,
    0.99 * ik
  );
  twistBone(b.leftUpperArm, frame.forward, -0.16 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.05 * ik);
  setHandBasis(
    b.leftHand,
    frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.2).normalize(),
    UP.clone().multiplyScalar(0.96).addScaledVector(frame.forward, -0.08).addScaledVector(frame.side, -0.04).normalize(),
    cueDir,
    -0.22 * ik,
    0.98 * ik
  );
  poseFingers(human.leftFingers, 'bridge', ik);

  aimTwoBone(
    b.leftUpperLeg,
    b.leftLowerLeg,
    frame.leftKnee,
    frame.leftFootWorld,
    frame.forward.clone().addScaledVector(UP, 0.12).normalize(),
    0.68 * ik,
    0.84 * ik
  );
  twistBone(b.leftUpperLeg, frame.forward, -0.07 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.1 * ik, 0.68 * ik);
  aimTwoBone(
    b.rightUpperLeg,
    b.rightLowerLeg,
    frame.rightKnee,
    frame.rightFootWorld,
    frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(),
    0.68 * ik,
    0.84 * ik
  );
  twistBone(b.rightUpperLeg, frame.forward, 0.06 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.07 * ik, 0.68 * ik);
}

export function chooseHumanEdgePosition(cueBallWorld, aimForward, opts = {}) {
  const tableW = opts.tableW ?? 2.0;
  const tableL = opts.tableL ?? 3.6;
  const edgeMargin = opts.edgeMargin ?? 0.62;
  const desiredShootDistance = opts.desiredShootDistance ?? 1.06;

  const desired = cueBallWorld.clone().addScaledVector(aimForward, -desiredShootDistance);
  const xEdge = tableW / 2 + edgeMargin;
  const zEdge = tableL / 2 + edgeMargin;
  const candidates = [
    new THREE.Vector3(-xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(xEdge, 0, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, -zEdge),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), 0, zEdge)
  ];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}

export function updateBilardoHumanPose(human, dt, frameData) {
  if (!human || !frameData) return;
  if (!Number.isFinite(dt) || dt < 0) return;
  if (!frameData.rootTarget || !frameData.aimForward) return;
  const cfg = human.cfg;
  const state = frameData.state || 'idle';

  human.poseT = dampScalar(human.poseT, state === 'idle' ? 0 : 1, cfg.poseLambda, dt);
  human.breathT += dt * (state === 'idle' ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, state === 'dragging' ? 1 : 0, 5.5, dt);

  if (state === 'striking') {
    if (human.strikeClock === 0) {
      human.strikeRoot.copy(
        human.root.position.lengthSq() > 0.001 ? human.root.position : frameData.rootTarget
      );
      human.strikeYaw = human.yaw;
    }
    human.strikeClock += dt;
  } else {
    human.strikeClock = 0;
  }

  const rootGoal = state === 'striking' ? human.strikeRoot : frameData.rootTarget;
  if (!Number.isFinite(rootGoal?.x) || !Number.isFinite(rootGoal?.y) || !Number.isFinite(rootGoal?.z)) {
    return;
  }
  human.root.position.lerp(rootGoal, 1 - Math.exp(-(state === 'striking' ? 12 : cfg.moveLambda) * dt));
  const moveAmountRaw = human.root.position.distanceTo(rootGoal);
  human.walkT += dt * (2 + Math.min(7, moveAmountRaw * 10));
  human.yaw = dampScalar(
    human.yaw,
    state === 'striking' ? human.strikeYaw : yawFromForward(frameData.aimForward),
    cfg.rotLambda,
    dt
  );

  const t = easeInOut(human.poseT);
  const idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * (0.006 + idle * 0.004);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, moveAmountRaw * 12);
  const walkAmount = clamp01(moveAmountRaw * 18) * idle;
  const power = frameData.power ?? 0;
  const stroke =
    state === 'dragging'
      ? Math.sin(performance.now() * 0.011) * (0.25 + power * 0.75)
      : 0;
  const follow =
    state === 'striking'
      ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI)
      : 0;

  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = power * t;
  const lowerBodyT = t;

  const rootWorld = human.root.position.clone().addScaledVector(forward, 0.018 * powerLean + 0.026 * follow);
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.12, t) + breath, lerp(0.02, -0.16, t) - 0.014 * powerLean));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.22, t) + breath, lerp(0.02, -0.42, t) - 0.024 * powerLean));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.25, t) + breath, lerp(0.02, -0.61, t) - 0.028 * powerLean));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.34, t) + breath - cfg.chinToCueHeight * 0.16 * t, lerp(0.04, -0.72, t) - 0.028 * powerLean));
  const leftShoulder = local(new THREE.Vector3(-0.23, lerp(1.58, 1.36, t) + breath, lerp(0, -0.46, t) - 0.018 * human.settleT));
  const leftHip = local(new THREE.Vector3(-0.13, 0.92, 0.02));
  const rightHip = local(new THREE.Vector3(0.13, 0.92, 0.02));
  const leftFoot = local(
    new THREE.Vector3(-0.13, 0.035, 0.03 + walk * 0.03).lerp(
      new THREE.Vector3(-cfg.stanceWidth * 0.42, 0.035, -0.36),
      lowerBodyT
    )
  );
  const rightFoot = local(
    new THREE.Vector3(0.13, 0.035, -0.03 - walk * 0.03).lerp(
      new THREE.Vector3(cfg.stanceWidth * 0.5, 0.035, 0.36),
      lowerBodyT
    )
  );

  const leftHand = frameData.idleLeft
    .clone()
    .lerp(
      frameData.bridgeTarget
        .clone()
        .addScaledVector(forward, -0.026 * t)
        .addScaledVector(side, -0.018 * t)
        .setY(cfg.tableTopY + cfg.bridgePalmTableLift)
        .addScaledVector(UP, -0.006 * human.settleT),
      t
    );
  const rightHand = frameData.idleRight
    .clone()
    .lerp(
      frameData.gripTarget
        .clone()
        .addScaledVector(forward, 0.032 * stroke * t + 0.052 * follow * power)
        .addScaledVector(UP, -0.007 * follow),
      t
    );

  const leftElbow = leftShoulder
    .clone()
    .lerp(leftHand, 0.57)
    .addScaledVector(UP, 0.02 * t)
    .addScaledVector(side, -0.03 * t)
    .addScaledVector(forward, 0.035 * t);
  const rightElbow = rightHand
    .clone()
    .addScaledVector(UP, lerp(0.18, cfg.cueArmElbowRise, t))
    .addScaledVector(side, lerp(0.03, 0.07, t))
    .addScaledVector(forward, lerp(-0.03, 0, t));
  const clipDrivenMode =
    human.clipDrivenWalkEnabled && state === 'idle' && frameData.forceIk !== true
      ? (walkAmount > 0.02 ? 'walk' : 'idle')
      : null;
  if (clipDrivenMode) {
    human.root.visible = true;
    updateClipDrivenHuman(human, dt, {
      rootWorld: human.root.position.clone(),
      t,
      breath
    }, clipDrivenMode);
    return;
  }

  const leftKnee = leftHip
    .clone()
    .lerp(leftFoot, 0.53)
    .addScaledVector(UP, lerp(0.18, 0.105, lowerBodyT))
    .addScaledVector(forward, 0.052 * lowerBodyT)
    .addScaledVector(side, -0.016 * lowerBodyT);
  const rightKnee = rightHip
    .clone()
    .lerp(rightFoot, 0.52)
    .addScaledVector(UP, lerp(0.18, 0.08, lowerBodyT))
    .addScaledVector(forward, -0.032 * lowerBodyT)
    .addScaledVector(side, 0.018 * lowerBodyT);

  human.root.visible = true;
  driveHuman(human, {
    t,
    breath,
    stroke,
    follow,
    walkAmount,
    forward,
    side,
    up: UP,
    rootWorld,
    torsoCenterWorld: torso,
    chestCenterWorld: chest,
    neckWorld: neck,
    headCenterWorld: head,
    leftElbow,
    rightElbow,
    leftHandWorld: leftHand,
    rightHandWorld: rightHand,
    leftKnee,
    rightKnee,
    leftFootWorld: leftFoot,
    rightFootWorld: rightFoot,
    cueBackWorld: frameData.cueBack || frameData.bridgeTarget || frameData.rootTarget,
    cueTipWorld: frameData.cueTip || frameData.gripTarget || frameData.rootTarget
  });
}
