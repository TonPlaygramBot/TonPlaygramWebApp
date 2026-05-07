import * as THREE from 'three';

const HUMAN_URL = 'https://threejs.org/examples/models/gltf/readyplayer.me.glb';
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const UP = Y_AXIS;
const BASIS_MAT = new THREE.Matrix4();


const REALISTIC_HUMAN_MATERIALS = Object.freeze({
  skin: 0xd7a47b,
  hair: 0x2d1d16,
  top: 0x2368b8,
  bottom: 0x25324a,
  shoes: 0x4a3328,
  eyes: 0xf5f7fb,
  teeth: 0xf4eadc,
  defaultFabric: 0x8b5a3c
});


const HUMAN_POLYHAVEN_TEXTURES = Object.freeze({
  // Poly Haven CC0 texture GLTF sets: each clothing role uses its own scanned material,
  // so shirts, trousers and shoes no longer share one generic avatar material.
  top: Object.freeze({ asset: 'cotton_jersey', tint: 0xdce6ee, repeat: 4.4, normalScale: 0.55 }),
  bottom: Object.freeze({ asset: 'denim_fabric', tint: 0xaab7ca, repeat: 5.2, normalScale: 0.72 }),
  shoes: Object.freeze({ asset: 'brown_leather', tint: 0x8a5f42, repeat: 3.2, normalScale: 0.5 })
});

const HUMAN_POLYHAVEN_TEXTURE_CACHE = new Map();
const HUMAN_POLYHAVEN_RESOLUTION = '1k';
const HUMAN_POLYHAVEN_TEXTURE_BASE = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${HUMAN_POLYHAVEN_RESOLUTION}`;
let humanTextureLoader = null;

function getHumanTextureLoader() {
  if (!humanTextureLoader) {
    humanTextureLoader = new THREE.TextureLoader();
    humanTextureLoader.setCrossOrigin?.('anonymous');
  }
  return humanTextureLoader;
}

function configureHumanClothTexture(texture, { isColor = false, repeat = 4 } = {}) {
  if (!texture) return texture;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = 8;
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function polyhavenTextureUrl(asset, suffix) {
  return `${HUMAN_POLYHAVEN_TEXTURE_BASE}/${asset}/${asset}_${suffix}_${HUMAN_POLYHAVEN_RESOLUTION}.jpg`;
}

function loadHumanPolyhavenTextureSet(role) {
  const cfg = HUMAN_POLYHAVEN_TEXTURES[role];
  if (!cfg) return null;
  if (HUMAN_POLYHAVEN_TEXTURE_CACHE.has(role)) return HUMAN_POLYHAVEN_TEXTURE_CACHE.get(role);
  const loader = getHumanTextureLoader();
  const textureSet = {
    cfg,
    map: configureHumanClothTexture(loader.load(polyhavenTextureUrl(cfg.asset, 'diff')), {
      isColor: true,
      repeat: cfg.repeat
    }),
    normalMap: configureHumanClothTexture(loader.load(polyhavenTextureUrl(cfg.asset, 'nor_gl')), {
      repeat: cfg.repeat
    }),
    roughnessMap: configureHumanClothTexture(loader.load(polyhavenTextureUrl(cfg.asset, 'rough')), {
      repeat: cfg.repeat
    })
  };
  HUMAN_POLYHAVEN_TEXTURE_CACHE.set(role, textureSet);
  return textureSet;
}

function cloneHumanTexture(texture) {
  if (!texture) return null;
  const clone = texture.clone();
  clone.image = texture.image;
  clone.needsUpdate = true;
  return clone;
}

function resolveHumanSurfaceRole(obj, mat) {
  const key = cleanName(`${obj?.name || ''} ${mat?.name || ''}`);
  if (key.includes('skin') || key.includes('head') || key.includes('face') || key.includes('hand') || key.includes('arm')) return 'skin';
  if (key.includes('hair') || key.includes('beard') || key.includes('brow')) return 'hair';
  if (key.includes('eye')) return 'eyes';
  if (key.includes('teeth') || key.includes('tooth')) return 'teeth';
  if (key.includes('shoe') || key.includes('footwear') || key.includes('boot')) return 'shoes';
  if (key.includes('bottom') || key.includes('pant') || key.includes('trouser') || key.includes('jean') || key.includes('leg')) return 'bottom';
  if (key.includes('top') || key.includes('shirt') || key.includes('hoodie') || key.includes('jacket') || key.includes('torso') || key.includes('outfit')) return 'top';
  return 'fabric';
}

function applyPolyhavenHumanClothingMaterial(obj, mat) {
  if (!mat || mat.userData?.polyhavenHumanClothApplied) return;
  const role = resolveHumanSurfaceRole(obj, mat);
  const textureSet = loadHumanPolyhavenTextureSet(role);
  if (!textureSet) return;
  mat.map = cloneHumanTexture(textureSet.map);
  mat.normalMap = cloneHumanTexture(textureSet.normalMap);
  mat.roughnessMap = cloneHumanTexture(textureSet.roughnessMap);
  if (mat.color) mat.color.setHex(textureSet.cfg.tint);
  if ('roughness' in mat) mat.roughness = 0.82;
  if ('metalness' in mat) mat.metalness = 0.02;
  if ('normalScale' in mat) mat.normalScale = new THREE.Vector2(textureSet.cfg.normalScale, textureSet.cfg.normalScale);
  mat.userData = {
    ...(mat.userData || {}),
    polyhavenHumanClothApplied: true,
    polyhavenSource: textureSet.cfg.asset,
    polyhavenSourceFormat: 'Poly Haven texture GLTF material maps'
  };
}

function createHumanFaceDetails(human) {
  const head = human?.bones?.head;
  if (!head || head.userData?.poolRoyaleFaceDetailsApplied) return;
  const browMat = new THREE.MeshStandardMaterial({
    color: REALISTIC_HUMAN_MATERIALS.hair,
    roughness: 0.92,
    metalness: 0
  });
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7fbff,
    roughness: 0.34,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    metalness: 0
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: 0.48 });
  const browGeom = new THREE.BoxGeometry(0.074, 0.01, 0.012);
  const eyeGeom = new THREE.SphereGeometry(0.026, 16, 10);
  const pupilGeom = new THREE.SphereGeometry(0.009, 10, 8);
  const makeEye = (x) => {
    const eye = new THREE.Mesh(eyeGeom, eyeMat);
    eye.name = x < 0 ? 'PoolRoyale_LeftEyeDetail' : 'PoolRoyale_RightEyeDetail';
    eye.position.set(x, 0.055, -0.082);
    eye.scale.set(1, 0.64, 0.45);
    const pupil = new THREE.Mesh(pupilGeom, pupilMat);
    pupil.name = `${eye.name}_Pupil`;
    pupil.position.set(0, -0.001, -0.018);
    pupil.scale.set(0.8, 0.8, 0.42);
    eye.add(pupil);
    return eye;
  };
  const makeBrow = (x, zRot) => {
    const brow = new THREE.Mesh(browGeom, browMat);
    brow.name = x < 0 ? 'PoolRoyale_LeftEyebrowDetail' : 'PoolRoyale_RightEyebrowDetail';
    brow.position.set(x, 0.092, -0.087);
    brow.rotation.set(0.08, 0, zRot);
    return brow;
  };
  head.add(makeEye(-0.034), makeEye(0.034), makeBrow(-0.036, 0.16), makeBrow(0.036, -0.16));
  head.userData = {
    ...(head.userData || {}),
    poolRoyaleFaceDetailsApplied: true
  };
}

function isMostlyGreyColor(color) {
  if (!color) return true;
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return max - min < 0.075;
}

function pickHumanMaterialColor(obj, mat) {
  const role = resolveHumanSurfaceRole(obj, mat);
  if (role === 'skin') return REALISTIC_HUMAN_MATERIALS.skin;
  if (role === 'hair') return REALISTIC_HUMAN_MATERIALS.hair;
  if (role === 'eyes') return REALISTIC_HUMAN_MATERIALS.eyes;
  if (role === 'teeth') return REALISTIC_HUMAN_MATERIALS.teeth;
  if (role === 'shoes') return REALISTIC_HUMAN_MATERIALS.shoes;
  if (role === 'bottom') return REALISTIC_HUMAN_MATERIALS.bottom;
  if (role === 'top') return REALISTIC_HUMAN_MATERIALS.top;
  return REALISTIC_HUMAN_MATERIALS.defaultFabric;
}

function applyRealisticHumanMaterialFallback(obj, mat) {
  if (!mat || !mat.color || mat.userData?.realisticHumanFallbackApplied) return;
  const shouldTint = !mat.map || isMostlyGreyColor(mat.color);
  if (!shouldTint) return;
  mat.color.setHex(pickHumanMaterialColor(obj, mat));
  if ('roughness' in mat) mat.roughness = Math.max(0.58, mat.roughness ?? 0.72);
  if ('metalness' in mat) mat.metalness = Math.min(0.04, mat.metalness ?? 0);
  mat.userData = {
    ...(mat.userData || {}),
    realisticHumanFallbackApplied: true
  };
}

const BASE_CFG = {
  unit: 1,
  poseLambda: 9,
  moveLambda: 5.6,
  rotLambda: 8.5,
  humanScale: 1.26,
  humanVisualYawFix: Math.PI,
  stanceWidth: 0.52,
  bridgePalmTableLift: 0.006,
  bridgeCueLift: 0.018,
  bridgeHandBackFromBall: 0.235,
  bridgeHandSide: -0.012,
  bridgePoseUsesConfiguredSide: false,
  bridgeArmStraightDownStrength: 0,
  chinToCueHeight: 0.11,
  footGroundY: 0.035,
  footLockStrength: 1.0,
  kneeBendShot: 0.16,
  rightElbowShotRise: 0.18,
  rightElbowShotSide: -0.46,
  rightElbowShotBack: -0.78,
  rightForearmOutward: 0.36,
  rightForearmBack: 0.44,
  rightForearmDown: 0.48,
  rightForearmLength: 0.34,
  rightStrokePull: 0.30,
  rightStrokePush: 0.24,
  rightHandShotLift: -0.30,
  shootCueGripFromBack: 0.58,
  idleRightHandY: 0.8,
  idleRightHandX: 0.31,
  idleRightHandZ: -0.015,
  idleCueGripFromBack: 0.24,
  idleCueDir: new THREE.Vector3(0.055, 0.965, -0.13),
  rightHandRollIdle: -2.2,
  rightHandRollShoot: -2.05,
  rightHandDownPose: 0.42,
  rightHandCueSocketLocal: new THREE.Vector3(-0.004, -0.014, 0.092),
  edgeMargin: 0.68,
  desiredShootDistance: 1.25,
  strikeTime: 0.12,
  holdTime: 0.05,
  tableTopY: 0.84,
  groundY: 0,
  perimeterWalk: false,
  perimeterWalkSpeed: 4.0,
  // The shooting pose bends the upper body away from the cue-side fold while the
  // IK feet stay planted on the floor. Pool Royale can override the strength,
  // but the default keeps spine/chest/head targets on the opposite side.
  shootBendDirection: -1,
  shootCounterLeanSide: -1,
  shootUpperBodyCounterLean: 1,
  plantFeetDuringShot: true,
  forceTableFacingAim: true
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => t * t * (3 - 2 * t);
const dampScalar = (current, target, lambda, dt) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
const dampVector = (current, target, lambda, dt) =>
  current.lerp(target, 1 - Math.exp(-lambda * dt));
const yawFromForward = (forward) => Math.atan2(-forward.x, -forward.z);
const cleanName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');


function resolveTableFacingForward(rawForward, root, frameData, cfg) {
  const forward = rawForward?.clone?.() ?? new THREE.Vector3(0, 0, -1);
  forward.y = 0;
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  forward.normalize();

  if (!cfg.forceTableFacingAim) return forward;

  const cueReference = frameData.bridgeTarget || frameData.cueTip || frameData.cueBack || frameData.gripTarget;
  if (!cueReference || !root) return forward;

  const rootToTable = cueReference.clone().sub(root);
  rootToTable.y = 0;
  if (rootToTable.lengthSq() < 1e-8) return forward;
  rootToTable.normalize();

  // The avatar must always face from the stance/root toward the table/cue ball.
  // If caller math ever supplies the opposite cue axis, flip it here so every
  // downstream torso, bridge hand, grip hand and foot basis bends toward the cloth.
  return forward.dot(rootToTable) < 0 ? forward.multiplyScalar(-1) : forward;
}

function scaleVectorConfig(cfg) {
  const next = { ...BASE_CFG, ...cfg };
  if (!(next.rightHandCueSocketLocal instanceof THREE.Vector3)) {
    const socket = next.rightHandCueSocketLocal || BASE_CFG.rightHandCueSocketLocal;
    next.rightHandCueSocketLocal = new THREE.Vector3(socket.x, socket.y, socket.z);
  } else {
    next.rightHandCueSocketLocal = next.rightHandCueSocketLocal.clone();
  }
  if (!(next.idleCueDir instanceof THREE.Vector3)) {
    const dir = next.idleCueDir || BASE_CFG.idleCueDir;
    next.idleCueDir = new THREE.Vector3(dir.x, dir.y, dir.z);
  } else {
    next.idleCueDir = next.idleCueDir.clone();
  }
  return next;
}


function resolveWalkPerimeter(cfg) {
  if (!cfg.perimeterWalk || !Number.isFinite(cfg.tableW) || !Number.isFinite(cfg.tableL)) return null;
  const halfX = cfg.tableW / 2 + (cfg.edgeMargin || 0);
  const halfZ = cfg.tableL / 2 + (cfg.edgeMargin || 0);
  if (halfX <= 0 || halfZ <= 0) return null;
  return { halfX, halfZ, length: 4 * (halfX + halfZ) };
}

function clampPointToWalkPerimeter(point, perimeter) {
  const { halfX, halfZ } = perimeter;
  const x = clamp(point.x, -halfX, halfX);
  const z = clamp(point.z, -halfZ, halfZ);
  const dx = Math.min(Math.abs(x + halfX), Math.abs(x - halfX));
  const dz = Math.min(Math.abs(z + halfZ), Math.abs(z - halfZ));
  if (dx < dz) return new THREE.Vector3(x < 0 ? -halfX : halfX, 0, z);
  return new THREE.Vector3(x, 0, z < 0 ? -halfZ : halfZ);
}

function pointToPerimeterT(point, perimeter) {
  const p = clampPointToWalkPerimeter(point, perimeter);
  const { halfX, halfZ, length } = perimeter;
  let d = 0;
  if (Math.abs(p.z + halfZ) < Math.abs(p.x - halfX) && Math.abs(p.z + halfZ) < Math.abs(p.z - halfZ)) {
    d = p.x + halfX;
  } else if (Math.abs(p.x - halfX) <= Math.abs(p.z - halfZ)) {
    d = 2 * halfX + (p.z + halfZ);
  } else if (Math.abs(p.z - halfZ) <= Math.abs(p.x + halfX)) {
    d = 2 * halfX + 2 * halfZ + (halfX - p.x);
  } else {
    d = 4 * halfX + 2 * halfZ + (halfZ - p.z);
  }
  return THREE.MathUtils.euclideanModulo(d / length, 1);
}

function perimeterTToPoint(t, perimeter) {
  const { halfX, halfZ, length } = perimeter;
  let d = THREE.MathUtils.euclideanModulo(t, 1) * length;
  if (d <= 2 * halfX) return new THREE.Vector3(-halfX + d, 0, -halfZ);
  d -= 2 * halfX;
  if (d <= 2 * halfZ) return new THREE.Vector3(halfX, 0, -halfZ + d);
  d -= 2 * halfZ;
  if (d <= 2 * halfX) return new THREE.Vector3(halfX - d, 0, halfZ);
  d -= 2 * halfX;
  return new THREE.Vector3(-halfX, 0, halfZ - d);
}

function moveRootAroundPerimeter(human, rootGoal, cfg, dt) {
  const perimeter = resolveWalkPerimeter(cfg);
  if (!perimeter) {
    dampVector(human.root.position, rootGoal, cfg.moveLambda, dt);
    human.root.position.y = cfg.groundY;
    return human.root.position.distanceTo(rootGoal);
  }
  const goal = clampPointToWalkPerimeter(rootGoal, perimeter);
  goal.y = cfg.groundY;
  if (human.root.position.lengthSq() < 1e-6) human.root.position.copy(goal);
  else human.root.position.copy(clampPointToWalkPerimeter(human.root.position, perimeter)).setY(cfg.groundY);
  if (!Number.isFinite(human.perimeterT)) human.perimeterT = pointToPerimeterT(human.root.position, perimeter);
  const targetT = pointToPerimeterT(goal, perimeter);
  const loopDelta = THREE.MathUtils.euclideanModulo(targetT - human.perimeterT + 0.5, 1) - 0.5;
  const maxStep = ((cfg.perimeterWalkSpeed || 4 * cfg.unit) * Math.max(dt, 1 / 240)) / perimeter.length;
  human.perimeterT = THREE.MathUtils.euclideanModulo(human.perimeterT + clamp(loopDelta, -maxStep, maxStep), 1);
  human.root.position.copy(perimeterTToPoint(human.perimeterT, perimeter)).setY(cfg.groundY);
  return human.root.position.distanceTo(goal);
}

function makeBasisQuaternion(side, up, forward) {
  BASIS_MAT.makeBasis(
    side.clone().normalize(),
    up.clone().normalize(),
    forward.clone().normalize()
  );
  return new THREE.Quaternion().setFromRotationMatrix(BASIS_MAT);
}

function findBone(all, aliases) {
  const list = all.map((bone) => ({ bone, name: cleanName(bone.name) }));
  const names = aliases.map(cleanName);
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

function normalizeHuman(model, cfg) {
  model.scale.setScalar(cfg.humanScale);
  model.rotation.set(0, cfg.humanVisualYawFix, 0);
  model.position.set(0, 0, 0);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

export function createHumanRig(scene, opts = {}) {
  const cfg = scaleVectorConfig(opts);
  const human = {
    root: new THREE.Group(),
    modelRoot: new THREE.Group(),
    model: null,
    bones: {},
    leftFingers: [],
    rightFingers: [],
    restQuats: new Map(),
    activeGlb: false,
    poseT: 0,
    walkT: 0,
    yaw: 0,
    breathT: 0,
    settleT: 0,
    strikeRoot: new THREE.Vector3(),
    strikeYaw: 0,
    strikeClock: 0,
    cfg
  };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot);

  const { loader, modelUrl = HUMAN_URL, onStatus } = opts;
  if (!loader) return human;
  loader.setCrossOrigin?.('anonymous');
  onStatus?.('Loading original skeleton human logic…');
  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf?.scene;
      if (!model) return;
      normalizeHuman(model, cfg);
      model.traverse((obj) => {
        if (!obj?.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
        const sourceMats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        const mats = sourceMats.map((mat) => (mat?.clone ? mat.clone() : mat));
        if (Array.isArray(obj.material)) obj.material = mats;
        else if (mats[0]) obj.material = mats[0];
        mats.forEach((mat) => {
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.flipY = false;
            mat.map.needsUpdate = true;
          }
          applyRealisticHumanMaterialFallback(obj, mat);
          applyPolyhavenHumanClothingMaterial(obj, mat);
          mat.depthWrite = true;
          mat.depthTest = true;
          mat.needsUpdate = true;
        });
      });
      human.bones = buildAvatarBones(model);
      human.leftFingers = collectFingerBones(human.bones.leftHand);
      human.rightFingers = collectFingerBones(human.bones.rightHand);
      [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => {
        if (bone) human.restQuats.set(bone, bone.quaternion.clone());
      });
      createHumanFaceDetails(human);
      const b = human.bones;
      human.activeGlb = Boolean(
        b.hips && b.spine && b.head && b.rightUpperArm && b.rightLowerArm && b.rightHand &&
        b.leftUpperLeg && b.leftLowerLeg && b.leftFoot && b.rightUpperLeg && b.rightLowerLeg && b.rightFoot
      );
      human.model = model;
      human.modelRoot.add(model);
      human.modelRoot.visible = human.activeGlb;
      onStatus?.(human.activeGlb ? 'Original human skeleton logic restored' : 'Human loaded, skeleton aliases incomplete');
    },
    undefined,
    (error) => {
      console.warn('ReadyPlayer human failed', error);
      onStatus?.('ReadyPlayer GLTF human failed');
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
  const childPos = firstBoneChild(bone)?.getWorldPosition(new THREE.Vector3()) ||
    bonePos.clone().addScaledVector(fallbackDir.clone().normalize(), 0.25);
  const current = childPos.sub(bonePos).normalize();
  const desired = target.clone().sub(bonePos);
  if (desired.lengthSq() < 1e-6 || current.lengthSq() < 1e-6) return;
  const delta = new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(),
    new THREE.Quaternion().setFromUnitVectors(current, desired.normalize()),
    clamp01(strength)
  );
  setBoneWorldQuaternion(bone, delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion())));
}
function twistBone(bone, axis, amount) {
  if (!bone || Math.abs(amount) < 1e-5) return;
  setBoneWorldQuaternion(
    bone,
    new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), amount)
      .multiply(bone.getWorldQuaternion(new THREE.Quaternion()))
  );
}
function aimTwoBone(upper, lower, elbow, hand, pole, upperStrength = 0.96, lowerStrength = 0.98) {
  for (let i = 0; i < 4; i += 1) {
    rotateBoneToward(upper, elbow, upperStrength, pole);
    rotateBoneToward(lower, hand, lowerStrength, pole);
  }
}
function setHandBasis(bone, side, up, forward, roll = 0, strength = 1) {
  if (!bone || strength <= 0) return;
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-4) {
    q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  }
  setBoneWorldQuaternion(bone, bone.getWorldQuaternion(new THREE.Quaternion()).slerp(q, clamp01(strength)));
}
function cueSocketOffsetWorld(side, up, forward, roll, socketLocal) {
  const q = makeBasisQuaternion(side, up, forward);
  if (Math.abs(roll) > 1e-5) q.multiply(new THREE.Quaternion().setFromAxisAngle(forward.clone().normalize(), roll));
  return socketLocal.clone().applyQuaternion(q);
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
    const mid = n.includes('2') || n.includes('intermediate');
    const tip = n.includes('3') || n.includes('distal');
    if (mode === 'idle') {
      finger.rotation.x += 0.018 * w;
      finger.rotation.z += 0.01 * w * (i % 2 ? -1 : 1);
      return;
    }
    if (mode === 'grip') {
      if (thumb) {
        finger.rotation.x += 0.48 * w;
        finger.rotation.y += -0.82 * w;
        finger.rotation.z += 0.54 * w;
        return;
      }
      const curl = index ? (base ? 0.58 : mid ? 0.9 : 0.68) : middle ? (base ? 0.76 : mid ? 1.02 : 0.76) : ring ? (base ? 0.72 : mid ? 0.92 : 0.7) : pinky ? (base ? 0.62 : mid ? 0.82 : 0.62) : 0;
      finger.rotation.x += curl * w;
      finger.rotation.y += (index ? -0.12 : middle ? -0.03 : ring ? 0.04 : pinky ? 0.08 : 0) * w;
      finger.rotation.z += (index ? -0.08 : middle ? -0.02 : ring ? 0.06 : pinky ? 0.12 : 0) * w;
      return;
    }
    if (thumb) {
      finger.rotation.x += -0.18 * w;
      finger.rotation.y += 0.95 * w;
      finger.rotation.z += -0.95 * w;
    } else if (index) {
      finger.rotation.x += (base ? 0.26 : mid ? 0.42 : 0.28) * w;
      finger.rotation.y += -0.46 * w;
      finger.rotation.z += -0.42 * w;
    } else if (middle) {
      finger.rotation.x += (base ? 0.18 : mid ? 0.32 : 0.22) * w;
      finger.rotation.y += -0.12 * w;
      finger.rotation.z += -0.14 * w;
    } else if (ring || pinky) {
      finger.rotation.x += (base ? (ring ? 0.08 : 0.05) : mid ? (ring ? 0.18 : 0.16) : tip ? (ring ? 0.12 : 0.1) : 0.1) * w;
      finger.rotation.y += (ring ? 0.18 : 0.34) * w;
      finger.rotation.z += (ring ? 0.28 : 0.46) * w;
    }
  });
}

function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) return;
  const cfg = human.cfg;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);
  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const standingCueDir = cfg.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);

  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 6.2);
    const c = Math.cos(human.walkT * 6.2);
    const w = frame.walkAmount * idle;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += s * 0.22 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x -= s * 0.22 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += Math.max(0, -s) * 0.18 * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += Math.max(0, s) * 0.18 * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x -= s * 0.2 * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += s * 0.2 * w;
    if (b.spine) b.spine.rotation.z += c * 0.02 * w;
    if (b.hips) b.hips.rotation.z -= c * 0.014 * w;
  }

  if (ik >= 0.025) {
    rotateBoneToward(b.hips, frame.torsoCenterWorld, (0.12 + 0.35 * ik) * ik, frame.forward);
    twistBone(b.hips, frame.side, -0.045 * ik);
    twistBone(b.hips, frame.forward, -0.025 * ik);
    rotateBoneToward(b.spine, frame.chestCenterWorld, (0.34 + 0.34 * ik) * ik, frame.forward);
    twistBone(b.spine, frame.side, -0.2 * ik);
    twistBone(b.spine, frame.forward, -0.04 * ik);
    rotateBoneToward(b.chest, frame.neckWorld, (0.5 + 0.28 * ik) * ik, frame.forward);
    twistBone(b.chest, frame.side, -0.32 * ik);
    twistBone(b.chest, frame.forward, -0.025 * ik);
    rotateBoneToward(b.neck, frame.headCenterWorld, 0.64 * ik, frame.forward);
    twistBone(b.neck, frame.side, -0.12 * ik);
    if (b.head) {
      setBoneWorldQuaternion(
        b.head,
        b.head.getWorldQuaternion(new THREE.Quaternion()).slerp(
          shotQ.clone()
            .multiply(new THREE.Quaternion().setFromAxisAngle(frame.side, -0.12 * ik))
            .multiply(new THREE.Quaternion().setFromAxisAngle(frame.forward, -0.025 * ik)),
          0.74 * ik
        )
      );
    }
    human.modelRoot.updateMatrixWorld(true);
  }

  const rightGrip = frame.rightHandWorld.clone();
  const rightIdleElbow = rightGrip.clone()
    .addScaledVector(UP, 0.04 * cfg.unit + 0.14 * cfg.unit * ik)
    .addScaledVector(frame.side, -0.2 * cfg.unit)
    .addScaledVector(frame.forward, -0.03 * cfg.unit * idle);
  const rightElbow = frame.rightElbow.clone().lerp(rightIdleElbow, idle * 0.5);
  const pole = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.32).addScaledVector(frame.forward, -0.55).normalize();
  aimTwoBone(b.rightUpperArm, b.rightLowerArm, rightElbow, rightGrip, pole, 0.9 + 0.1 * ik, 1.0);
  const standingHandSide = frame.side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(frame.forward, 0.16).normalize();
  const standingHandUp = UP.clone().multiplyScalar(-1.0).addScaledVector(frame.side, -0.64).addScaledVector(frame.forward, 0.2).normalize();
  const handForwardForOrientation = ik >= 0.025 ? cueDir : standingCueDir;
  setHandBasis(b.rightHand, standingHandSide, standingHandUp, handForwardForOrientation, cfg.rightHandRollIdle, 1.0);
  poseFingers(human.rightFingers, 'grip', 0.95);
  if (ik < 0.025) {
    poseFingers(human.leftFingers, 'idle', 1);
    return;
  }

  const bridgeIkHandSide = cfg.bridgePoseUsesConfiguredSide
    ? cfg.bridgeHandSide * 0.8
    : -0.018 * cfg.unit;
  const bridgeIkElbowSide = cfg.bridgePoseUsesConfiguredSide
    ? cfg.bridgeHandSide * 1.15
    : -0.05 * cfg.unit;
  const leftHand = frame.leftHandWorld.clone()
    .addScaledVector(frame.forward, 0.032 * cfg.unit * ik)
    .addScaledVector(frame.side, bridgeIkHandSide * ik)
    .addScaledVector(UP, -0.018 * cfg.unit * ik);
  const leftElbow = frame.leftElbow.clone()
    .addScaledVector(frame.forward, 0.045 * cfg.unit * ik)
    .addScaledVector(frame.side, bridgeIkElbowSide * ik)
    .addScaledVector(UP, -0.01 * cfg.unit * ik);
  aimTwoBone(b.leftUpperArm, b.leftLowerArm, leftElbow, leftHand, frame.side.clone().multiplyScalar(-1).addScaledVector(UP, 0.1).normalize(), 0.98 * ik, 1.0 * ik);
  twistBone(b.leftUpperArm, frame.forward, -0.2 * ik);
  twistBone(b.leftLowerArm, frame.forward, 0.025 * ik);
  const bridgeSide = frame.side.clone().multiplyScalar(-1).addScaledVector(frame.forward, -0.52).normalize();
  const bridgeUp = UP.clone().multiplyScalar(0.78).addScaledVector(frame.forward, -0.28).addScaledVector(frame.side, -0.16).normalize();
  setHandBasis(b.leftHand, bridgeSide, bridgeUp, cueDir, -0.68 * ik, 1.0 * ik);
  poseFingers(human.leftFingers, 'bridge', ik);
  aimTwoBone(b.leftUpperLeg, b.leftLowerLeg, frame.leftKnee, frame.leftFootWorld, frame.forward.clone().addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.leftUpperLeg, frame.forward, -0.035 * ik);
  setHandBasis(b.leftFoot, frame.side, frame.up, frame.forward, -0.02 * ik, cfg.footLockStrength * ik);
  aimTwoBone(b.rightUpperLeg, b.rightLowerLeg, frame.rightKnee, frame.rightFootWorld, frame.forward.clone().multiplyScalar(-1).addScaledVector(UP, 0.18).normalize(), 0.9 * ik, 1.0 * ik);
  twistBone(b.rightUpperLeg, frame.forward, 0.03 * ik);
  setHandBasis(b.rightFoot, frame.side, frame.up, frame.forward, 0.02 * ik, cfg.footLockStrength * ik);
}

export function updateHumanPose(human, dt, frameData) {
  if (!human || !frameData || !Number.isFinite(dt) || dt < 0 || !frameData.rootTarget || !frameData.aimForward) return;
  const cfg = human.cfg;
  const state = frameData.state || 'idle';
  const activeState = state === 'rolling' || state === 'turnEnd' || state === 'gameOver' ? 'idle' : state;
  human.poseT = dampScalar(human.poseT, activeState === 'idle' ? 0 : 1, cfg.poseLambda, dt);
  human.breathT += dt * (activeState === 'idle' ? 1.05 : 0.5);
  human.settleT = dampScalar(human.settleT, activeState === 'dragging' ? 1 : 0, 5.5, dt);
  if (activeState === 'striking') {
    if (human.strikeClock === 0) {
      human.strikeRoot.copy(human.root.position.lengthSq() > 0.001 ? human.root.position : frameData.rootTarget);
      human.strikeYaw = human.yaw;
    }
    human.strikeClock += dt;
  } else {
    human.strikeClock = 0;
  }

  const rootGoal = activeState === 'striking' ? human.strikeRoot : frameData.rootTarget;
  const moveAmountRaw = activeState === 'striking'
    ? (() => {
        dampVector(human.root.position, rootGoal, 12, dt);
        human.root.position.y = cfg.groundY;
        return human.root.position.distanceTo(rootGoal);
      })()
    : moveRootAroundPerimeter(human, rootGoal, cfg, dt);
  human.walkT += dt * (2 + Math.min(7, (moveAmountRaw * 10) / cfg.unit));
  const facingForward = resolveTableFacingForward(frameData.aimForward, rootGoal, frameData, cfg);
  human.yaw = dampScalar(human.yaw, activeState === 'striking' ? human.strikeYaw : yawFromForward(facingForward), cfg.rotLambda, dt);

  const t = easeInOut(human.poseT);
  const idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * cfg.unit);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, (moveAmountRaw * 12) / cfg.unit);
  const walkAmount = clamp01((moveAmountRaw * 18) / cfg.unit) * idle;
  const dragStroke = activeState === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + (frameData.power || 0) * 0.75) : 0;
  const strikeFollow = activeState === 'striking' ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI) : 0;
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, human.yaw).add(human.root.position);
  const powerLean = (frameData.power || 0) * t;
  const bendDirection = cfg.shootBendDirection >= 0 ? 1 : -1;
  const counterLeanSide = cfg.shootCounterLeanSide >= 0 ? 1 : -1;
  const upperBodyCounterLean = Number.isFinite(cfg.shootUpperBodyCounterLean)
    ? Math.max(0, cfg.shootUpperBodyCounterLean)
    : 1;
  const plantFeetDuringShot = cfg.plantFeetDuringShot !== false;
  const shotBendZ = (value) => value * bendDirection;
  const shotCounterLeanX = (value) => value * counterLeanSide * upperBodyCounterLean;
  const rootWorld = human.root.position.clone();
  rootWorld.y = cfg.groundY;

  const torso = local(new THREE.Vector3(shotCounterLeanX(0.025 * t) * cfg.unit, lerp(1.3, 1.14, t) * cfg.unit + breath, shotBendZ(lerp(0.02, -0.16, t) - 0.014 * powerLean) * cfg.unit));
  const chest = local(new THREE.Vector3(shotCounterLeanX(0.07 * t + 0.012 * powerLean) * cfg.unit, lerp(1.52, 1.24, t) * cfg.unit + breath, shotBendZ(lerp(0.02, -0.42, t) - 0.024 * powerLean) * cfg.unit));
  const neck = local(new THREE.Vector3(shotCounterLeanX(0.105 * t + 0.016 * powerLean) * cfg.unit, lerp(1.68, 1.28, t) * cfg.unit + breath, shotBendZ(lerp(0.02, -0.61, t) - 0.028 * powerLean) * cfg.unit));
  const head = local(new THREE.Vector3(shotCounterLeanX(0.12 * t + 0.018 * powerLean) * cfg.unit, lerp(1.84, 1.37, t) * cfg.unit + breath - cfg.chinToCueHeight * 0.16 * t, shotBendZ(lerp(0.04, -0.72, t) - 0.028 * powerLean) * cfg.unit));
  const leftShoulder = local(new THREE.Vector3((-0.23 + shotCounterLeanX(0.075 * t)) * cfg.unit, lerp(1.58, 1.36, t) * cfg.unit + breath, shotBendZ(lerp(0, -0.46, t) - 0.018 * human.settleT) * cfg.unit));
  const rightShoulder = local(new THREE.Vector3((0.23 + shotCounterLeanX(0.058 * t)) * cfg.unit, lerp(1.58, 1.36, t) * cfg.unit + breath, shotBendZ(lerp(0, -0.34, t) - 0.018 * human.settleT) * cfg.unit));
  const leftHip = local(new THREE.Vector3(-0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const rightHip = local(new THREE.Vector3(0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const footWalkBlend = plantFeetDuringShot ? idle : 1;
  const plantedLeftFootLocal = new THREE.Vector3(
    -cfg.stanceWidth * 0.42,
    cfg.footGroundY,
    -0.34 * cfg.unit
  );
  const plantedRightFootLocal = new THREE.Vector3(
    cfg.stanceWidth * 0.5,
    cfg.footGroundY,
    0.34 * cfg.unit
  );
  const leftFoot = local(new THREE.Vector3(
    -0.13 * cfg.unit,
    cfg.footGroundY,
    0.03 * cfg.unit + walk * 0.018 * cfg.unit * footWalkBlend
  ).lerp(plantedLeftFootLocal, t));
  const rightFoot = local(new THREE.Vector3(
    0.13 * cfg.unit,
    cfg.footGroundY,
    -0.03 * cfg.unit - walk * 0.018 * cfg.unit * footWalkBlend
  ).lerp(plantedRightFootLocal, t));

  const bridgePalmSide = cfg.bridgePoseUsesConfiguredSide
    ? cfg.bridgeHandSide
    : -0.012 * cfg.unit;
  const bridgePalmTarget = frameData.bridgeTarget.clone()
    .addScaledVector(forward, -0.006 * cfg.unit * t)
    .addScaledVector(side, bridgePalmSide * t)
    .setY(cfg.tableTopY + cfg.bridgePalmTableLift)
    .addScaledVector(UP, -0.01 * cfg.unit * human.settleT);
  const leftHand = frameData.idleLeft.clone().lerp(bridgePalmTarget, t);
  const cueDirForHand = frameData.cueTip.clone().sub(frameData.cueBack).normalize();
  const handIk = easeInOut(clamp01(t));
  const idleGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, -0.55).addScaledVector(forward, 0.16).normalize();
  const idleGripUp = UP.clone().multiplyScalar(-1.0).addScaledVector(side, -0.64).addScaledVector(forward, 0.2).normalize();
  const liveGripSide = side.clone().multiplyScalar(-1).addScaledVector(UP, lerp(-0.55, -0.62, handIk)).addScaledVector(side, 0.5 * handIk).addScaledVector(forward, lerp(0.16, -0.08, handIk)).normalize();
  const liveGripUp = UP.clone().multiplyScalar(lerp(-1.0, 0.12, handIk)).addScaledVector(side, lerp(-0.64, -0.04, handIk)).addScaledVector(forward, lerp(0.2, -0.48, handIk)).normalize();
  const lockedRightElbow = rightShoulder.clone()
    .addScaledVector(UP, lerp(0.04 * cfg.unit, cfg.rightElbowShotRise, t))
    .addScaledVector(side, lerp(-0.18 * cfg.unit, cfg.rightElbowShotSide, t))
    .addScaledVector(forward, lerp(-0.04 * cfg.unit, cfg.rightElbowShotBack, t));
  const pullBack = activeState === 'dragging' ? -cfg.rightStrokePull * easeOutCubic(frameData.power || 0) : 0;
  const pushForward = activeState === 'striking' ? cfg.rightStrokePush * strikeFollow : 0;
  const smallPractice = activeState === 'dragging' ? dragStroke * 0.035 * cfg.unit : 0;
  const forearmStroke = pullBack + pushForward + smallPractice;
  const forearmBase = lockedRightElbow.clone()
    .addScaledVector(side, cfg.rightForearmOutward * t)
    .addScaledVector(UP, -cfg.rightForearmDown * t)
    .addScaledVector(UP, cfg.rightHandShotLift * t)
    .addScaledVector(forward, -cfg.rightForearmBack * t)
    .addScaledVector(cueDirForHand, cfg.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone().addScaledVector(cueDirForHand, forearmStroke);
  if (frameData.gripTarget) liveCueGripPoint.lerp(frameData.gripTarget, 0.72 * t);
  const idleWristTarget = frameData.idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, cfg.rightHandRollIdle, cfg.rightHandCueSocketLocal));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(cfg.rightHandRollIdle, cfg.rightHandRollShoot - cfg.rightHandDownPose, handIk), cfg.rightHandCueSocketLocal));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * cfg.unit * t).addScaledVector(side, -0.044 * cfg.unit * t).addScaledVector(forward, 0.065 * cfg.unit * t);
  const straightBridgeStrength = clamp01((cfg.bridgeArmStraightDownStrength ?? 0) * t);
  if (straightBridgeStrength > 0) {
    const straightLeftElbow = new THREE.Vector3(
      leftHand.x,
      THREE.MathUtils.lerp(leftShoulder.y, leftHand.y, 0.5),
      leftHand.z
    );
    leftElbow.lerp(straightLeftElbow, straightBridgeStrength);
  }
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot, t)).addScaledVector(forward, 0.04 * cfg.unit * t).addScaledVector(side, -0.012 * cfg.unit * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * cfg.unit * t).addScaledVector(side, 0.014 * cfg.unit * t);

  human.root.visible = true;
  driveHuman(human, {
    t,
    stroke: forearmStroke / cfg.unit,
    follow: strikeFollow,
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
    rightElbow: lockedRightElbow,
    leftHandWorld: leftHand,
    rightHandWorld: rightHand,
    leftKnee,
    rightKnee,
    leftFootWorld: leftFoot,
    rightFootWorld: rightFoot,
    cueBackWorld: frameData.cueBack,
    cueTipWorld: frameData.cueTip
  });
}

export function chooseHumanEdgePosition(cueBallWorld, aimForward, opts = {}) {
  const cfg = scaleVectorConfig(opts);
  const desired = cueBallWorld.clone().addScaledVector(aimForward, -cfg.desiredShootDistance);
  const xEdge = (opts.tableW ?? 2.0) / 2 + cfg.edgeMargin;
  const zEdge = (opts.tableL ?? 3.6) / 2 + cfg.edgeMargin;
  const groundY = cfg.groundY || 0;
  const candidates = [
    new THREE.Vector3(-xEdge, groundY, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(xEdge, groundY, clamp(desired.z, -zEdge, zEdge)),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), groundY, -zEdge),
    new THREE.Vector3(clamp(desired.x, -xEdge, xEdge), groundY, zEdge)
  ];
  return candidates.sort((a, b) => a.distanceToSquared(desired) - b.distanceToSquared(desired))[0].clone();
}
