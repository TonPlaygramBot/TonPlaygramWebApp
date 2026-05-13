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
  // The shooting pose can lock the upper-body fold to the live cue/bridge target
  // so the avatar leans toward the cue stick instead of relying on a fixed local
  // Z sign that may read as backwards after table/camera orientation changes.
  shootBendDirection: -1,
  shootBendTowardCueStick: false,
  shootBendMode: 'forward',
  shootCounterLeanSide: -1,
  shootUpperBodyCounterLean: 1,
  shootForwardBendScale: 1,
  plantFeetDuringShot: true,
  bridgeArmStraightDown: false,
  forceTableFacingAim: true,
  showDebugArrows: true,
  debugArrowLength: 0.72,
  railShotDistance: 0.34,
  longReachDistance: 0.78,
  closeCueBallDistance: 0.28,
  powerShotThreshold: 0.74,
  softShotThreshold: 0.26,
  addFaceDetails: true,
  originalSkeletonLogic: false
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


function resolveTableReference(frameData) {
  return frameData.bridgeTarget || frameData.cueTip || frameData.gripTarget || frameData.cueBack || null;
}


function resolveRootToTableForward(root, frameData) {
  const cueReference = resolveTableReference(frameData);
  if (!cueReference || !root) return null;
  const rootToTable = cueReference.clone().sub(root);
  rootToTable.y = 0;
  if (rootToTable.lengthSq() < 1e-8) return null;
  return rootToTable.normalize();
}

function resolveTableFacingForward(rawForward, root, frameData, cfg) {
  const forward = rawForward?.clone?.() ?? new THREE.Vector3(0, 0, -1);
  forward.y = 0;
  if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
  forward.normalize();

  if (!cfg.forceTableFacingAim) return forward;

  const rootToTable = resolveRootToTableForward(root, frameData);
  if (!rootToTable) return forward;

  // The avatar must always face from the stance/root toward the table/cue ball.
  // If caller math ever supplies the opposite cue axis, flip it here so every
  // downstream torso, bridge hand, grip hand and foot basis bends toward the cloth.
  return forward.dot(rootToTable) < 0 ? forward.multiplyScalar(-1) : forward;
}

function resolveShootBendSign(human, frameData, cfg) {
  const fallbackSign = cfg.shootBendDirection >= 0 ? 1 : -1;
  if (!cfg.shootBendTowardCueStick) return fallbackSign;
  const cueReference = resolveTableReference(frameData);
  if (!cueReference || !human?.root) return fallbackSign;
  const rootToTableLocal = cueReference
    .clone()
    .sub(human.root.position)
    .applyAxisAngle(Y_AXIS, -(human.yaw + (cfg.humanVisualYawFix || 0)));
  // Local -Z is the direction the rig is facing. Always fold the belly/chest/head
  // side toward the cue ball/table; feet and hips stay planted by the pose solver.
  return Math.abs(rootToTableLocal.z) > 1e-5
    ? (rootToTableLocal.z <= 0 ? -1 : 1)
    : -1;
}

function ensureHumanFacingTable(human, frameData, cfg) {
  if (!cfg.forceTableFacingAim || !human?.root) return;
  const cueReference = resolveTableReference(frameData);
  if (!cueReference) return;
  const rootToTable = cueReference.clone().sub(human.root.position);
  rootToTable.y = 0;
  if (rootToTable.lengthSq() < 1e-8) return;
  rootToTable.normalize();
  const visualYaw = human.yaw + (cfg.humanVisualYawFix || 0);
  const liveForward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, visualYaw).normalize();
  if (liveForward.dot(rootToTable) < -0.05) {
    const targetYaw = yawFromForward(rootToTable) - (cfg.humanVisualYawFix || 0);
    human.yaw = dampAngle(human.yaw, targetYaw, cfg.rotLambda * 1.6, 1 / 60);
  }
}

function dampAngle(current, target, lambda, dt) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function resolveShotType(frameData, cfg) {
  if (frameData?.shotType) return frameData.shotType;
  const reach = Number(frameData?.bridgeReach ?? 0);
  const power = Number(frameData?.power ?? 0);
  const railDistance = Number(frameData?.railDistance ?? Infinity);
  const cutAngle = Math.abs(Number(frameData?.cutAngle ?? 0));
  const cueTargetDistance = Number(frameData?.cueTargetDistance ?? Infinity);
  if (railDistance <= cfg.railShotDistance) return 'rail';
  if (reach >= cfg.longReachDistance) return 'longReach';
  if (cueTargetDistance <= cfg.closeCueBallDistance) return 'closeCueBall';
  if (power >= cfg.powerShotThreshold) return 'power';
  if (power > 0 && power <= cfg.softShotThreshold) return 'softPrecision';
  if (cutAngle >= Math.PI * 0.28) return 'difficultAngle';
  return 'standard';
}

function shotTypePoseProfile(shotType) {
  switch (shotType) {
    case 'rail':
      return { bridgeLift: 0.035, cueLift: 0.028, lean: 0.72, bridgeReach: -0.03, gripBack: -0.04, stanceBack: 0.02, stanceWide: 0.02, hipSide: 0.01, followScale: 0.82 };
    case 'longReach':
      return { bridgeLift: -0.002, cueLift: 0.01, lean: 1.18, bridgeReach: 0.16, gripBack: 0.07, stanceBack: 0.16, stanceWide: 0.07, hipSide: -0.01, followScale: 0.9 };
    case 'closeCueBall':
      return { bridgeLift: 0.006, cueLift: 0.014, lean: 0.82, bridgeReach: -0.12, gripBack: -0.16, stanceBack: -0.05, stanceWide: -0.04, hipSide: 0, followScale: 0.56 };
    case 'power':
      return { bridgeLift: 0.002, cueLift: 0.016, lean: 1.04, bridgeReach: 0.04, gripBack: 0.16, stanceBack: 0.12, stanceWide: 0.09, hipSide: 0.018, followScale: 1.32, recoil: 0.045 };
    case 'softPrecision':
      return { bridgeLift: 0.004, cueLift: 0.012, lean: 0.94, bridgeReach: 0.02, gripBack: -0.08, stanceBack: 0.01, stanceWide: -0.02, hipSide: -0.006, followScale: 0.44, headStill: 0.75 };
    case 'difficultAngle':
      return { bridgeLift: 0.006, cueLift: 0.018, lean: 1.0, bridgeReach: 0.04, bridgeSide: 0.055, gripBack: 0.02, stanceBack: 0.08, stanceWide: 0.04, hipSide: 0.055, followScale: 0.78 };
    default:
      return { bridgeLift: 0.004, cueLift: 0.014, lean: 1.0, bridgeReach: 0, gripBack: 0, stanceBack: 0, stanceWide: 0, hipSide: 0, followScale: 1.0 };
  }
}

function updateDebugArrow(arrow, origin, dir, color, length) {
  if (!arrow || !origin || !dir) return;
  const safeDir = dir.clone();
  safeDir.y = Number.isFinite(safeDir.y) ? safeDir.y : 0;
  if (safeDir.lengthSq() < 1e-8) safeDir.set(0, 0, -1);
  safeDir.normalize();
  arrow.position.copy(origin);
  arrow.setDirection(safeDir);
  arrow.setLength(length, length * 0.24, length * 0.12);
  arrow.setColor(new THREE.Color(color));
  arrow.visible = true;
}

function updateHumanDebugArrows(human, frameData, forward, cueDir, cfg) {
  const group = human?.debugArrows;
  if (!group) return;
  const enabled = cfg.showDebugArrows !== false;
  group.visible = enabled;
  if (!enabled) return;
  const length = Math.max(0.1, cfg.debugArrowLength || 0.72);
  const origin = human.root.position.clone().add(new THREE.Vector3(0, cfg.tableTopY + 0.1 * cfg.unit, 0));
  const tableCenter = frameData.tableCenter || new THREE.Vector3(0, origin.y, 0);
  const tableDir = tableCenter.clone().sub(origin).setY(0);
  const shotDir = frameData.aimForward?.clone?.() || forward.clone();
  const cueOrigin = frameData.cueBack?.clone?.() || origin.clone();
  updateDebugArrow(group.userData.tableCenterArrow, origin, tableDir, 0x38bdf8, length);
  updateDebugArrow(group.userData.shotDirectionArrow, frameData.cueTip || origin, shotDir, 0xfacc15, length);
  updateDebugArrow(group.userData.characterForwardArrow, origin.clone().add(new THREE.Vector3(0, 0.08 * cfg.unit, 0)), forward, 0x22c55e, length * 0.9);
  updateDebugArrow(group.userData.cueDirectionArrow, cueOrigin, cueDir, 0xf97316, length * 1.15);
}

function createHumanDebugArrows() {
  const group = new THREE.Group();
  group.name = 'PoolRoyale_HumanDebugArrows';
  group.renderOrder = 20;
  const make = (name, color) => {
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(), 1, color, 0.18, 0.08);
    arrow.name = name;
    arrow.visible = false;
    group.add(arrow);
    return arrow;
  };
  group.userData.tableCenterArrow = make('TableCenterDirection_DebugArrow_Blue', 0x38bdf8);
  group.userData.shotDirectionArrow = make('ShotDirection_DebugArrow_Yellow', 0xfacc15);
  group.userData.characterForwardArrow = make('CharacterForward_DebugArrow_Green', 0x22c55e);
  group.userData.cueDirectionArrow = make('CueDirection_DebugArrow_Orange', 0xf97316);
  return group;
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
    seatedBlend: 0,
    standTransitionT: 1,
    lastSeated: false,
    strikeRoot: new THREE.Vector3(),
    strikeYaw: 0,
    strikeClock: 0,
    mixer: null,
    actions: {},
    currentAction: 'Idle',
    poolPlayerState: 'IdleWaiting',
    lastShotType: 'standard',
    debugArrows: createHumanDebugArrows(),
    cfg
  };
  human.root.visible = false;
  human.modelRoot.visible = false;
  scene.add(human.root, human.modelRoot, human.debugArrows);

  const { loader, modelUrl = HUMAN_URL, onStatus } = opts;
  const modelUrls = Array.isArray(opts.modelUrls) && opts.modelUrls.length > 0
    ? opts.modelUrls.filter((url) => typeof url === 'string' && url.trim().length > 0)
    : [modelUrl];
  if (!loader) return human;
  loader.setCrossOrigin?.('anonymous');
  onStatus?.('Loading original skeleton human logic…');
  const loadModelAt = (urlIndex = 0) => {
    const activeUrl = modelUrls[urlIndex] || HUMAN_URL;
    loader.load(
      activeUrl,
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
        human.mixer = new THREE.AnimationMixer(model);
        const clipByName = new Map((gltf.animations || []).map((clip) => [String(clip.name || '').toLowerCase(), clip]));
        const aliases = {
          Idle: ['idle'],
          Walk: ['walk', 'walking'],
          Run: ['run', 'running']
        };
        Object.entries(aliases).forEach(([name, names]) => {
          const clip = names.map((alias) => clipByName.get(alias)).find(Boolean);
          if (!clip) return;
          const action = human.mixer.clipAction(clip);
          action.enabled = true;
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.clampWhenFinished = false;
          action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
          action.play();
          human.actions[name] = action;
        });
        human.bones = buildAvatarBones(model);
        human.leftFingers = collectFingerBones(human.bones.leftHand);
        human.rightFingers = collectFingerBones(human.bones.rightHand);
        [...Object.values(human.bones), ...human.leftFingers, ...human.rightFingers].forEach((bone) => {
          if (bone) human.restQuats.set(bone, bone.quaternion.clone());
        });
        if (human.cfg.addFaceDetails !== false) {
          createHumanFaceDetails(human);
        }
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
        console.warn('ReadyPlayer human failed', { url: activeUrl, error });
        if (urlIndex + 1 < modelUrls.length) {
          loadModelAt(urlIndex + 1);
          return;
        }
        onStatus?.('ReadyPlayer GLTF human failed');
      }
    );
  };
  loadModelAt(0);
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

function setHumanAction(human, next, blend = 0.18) {
  if (!human?.actions?.[next] || human.currentAction === next) return;
  const previous = human.actions[human.currentAction];
  const nextAction = human.actions[next];
  if (previous && nextAction) {
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    previous.crossFadeTo(nextAction, blend, false);
    nextAction.play();
  }
  human.currentAction = next;
}

function updateGoalRushWalkAnimation(human, dt, frame) {
  if (!human?.mixer || !human.actions?.Walk) return false;
  const walkWeight = frame.walkAmount * (1 - easeInOut(clamp01(frame.t)));
  const next = walkWeight > 0.05 ? 'Walk' : 'Idle';
  setHumanAction(human, next);
  const walk = human.actions.Walk;
  if (walk) {
    const ref = human.cfg?.perimeterWalkSpeed || human.cfg?.unit || 1;
    const normalizedSpeed = Math.max(0, Math.min(2, (human.lastMoveAmountRaw || 0) * 60 / Math.max(0.001, ref)));
    // Match the slower Soldier-style cadence: less skating, fuller leg/body motion.
    walk.timeScale = THREE.MathUtils.clamp((normalizedSpeed || walkWeight) * 0.72, 0.48, 0.95);
  }
  human.mixer.update(dt);
  return walkWeight > 0.05 && frame.t < 0.025;
}

function driveHuman(human, frame) {
  if (!human.activeGlb || !human.model) return;
  const cfg = human.cfg;
  human.modelRoot.visible = true;
  human.modelRoot.position.copy(frame.rootWorld);
  human.modelRoot.rotation.y = human.yaw;
  human.modelRoot.updateMatrixWorld(true);
  const usingGoalRushWalk = updateGoalRushWalkAnimation(human, frame.dt || 0, frame);
  if (usingGoalRushWalk) return;
  human.restQuats.forEach((q, bone) => bone.quaternion.copy(q));
  human.modelRoot.updateMatrixWorld(true);
  const b = human.bones;
  const ik = easeInOut(clamp01(frame.t));
  const idle = 1 - ik;
  const cueDir = frame.cueTipWorld.clone().sub(frame.cueBackWorld).normalize();
  const standingCueDir = cfg.idleCueDir.clone().applyAxisAngle(Y_AXIS, human.yaw).normalize();
  const shotQ = makeBasisQuaternion(frame.side, UP, frame.forward);

  const seatedBlend = clamp01(frame.seatedBlend ?? (frame.seated ? 1 : 0));
  if (seatedBlend > 0.015) {
    // Lounge waiting pose: the pelvis stays settled in the cushion while the
    // torso and head remain oriented toward the table.  The blend is reused as a
    // sit-to-stand layer so the player transfers weight before walking instead
    // of popping directly into the locomotion pose.
    const sitW = easeInOut(seatedBlend);
    const standW = 1 - sitW;
    const breathe = Math.sin(human.breathT * Math.PI * 2) * sitW;
    const idleShift = Math.sin(human.breathT * Math.PI * 0.74 + 0.8) * sitW;
    if (b.hips) {
      b.hips.rotation.x += THREE.MathUtils.degToRad(-18 + 9 * standW) * sitW;
      b.hips.rotation.y += THREE.MathUtils.degToRad(4.8 * idleShift + 3.5 * frame.side.x) * sitW;
      b.hips.rotation.z += THREE.MathUtils.degToRad(1.8 * idleShift) * sitW;
    }
    if (b.spine) {
      b.spine.rotation.x += THREE.MathUtils.degToRad(-6.5 - 0.9 * breathe) * sitW;
      b.spine.rotation.y += THREE.MathUtils.degToRad(8.5 + 2.2 * idleShift) * sitW;
      b.spine.rotation.z += THREE.MathUtils.degToRad(-2.2) * sitW;
    }
    if (b.chest) {
      b.chest.rotation.x += THREE.MathUtils.degToRad(-4.5 - 0.8 * breathe) * sitW;
      b.chest.rotation.y += THREE.MathUtils.degToRad(10.5 + 1.8 * idleShift) * sitW;
      b.chest.rotation.z += THREE.MathUtils.degToRad(1.4 * idleShift) * sitW;
    }
    if (b.neck) {
      b.neck.rotation.x += THREE.MathUtils.degToRad(3.5 - 0.8 * breathe) * sitW;
      b.neck.rotation.y += THREE.MathUtils.degToRad(-7.5 - 1.2 * idleShift) * sitW;
    }
    if (b.head) {
      b.head.rotation.x += THREE.MathUtils.degToRad(2.8 - 0.5 * breathe) * sitW;
      b.head.rotation.y += THREE.MathUtils.degToRad(-5.5 - 1.4 * idleShift) * sitW;
      rotateBoneToward(b.head, frame.cueTipWorld, 0.42 * sitW, frame.forward);
    }
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += THREE.MathUtils.degToRad(-89.5) * sitW;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x += THREE.MathUtils.degToRad(-84.5) * sitW;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.z += THREE.MathUtils.degToRad(-4.5) * sitW;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.z += THREE.MathUtils.degToRad(6.5) * sitW;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += THREE.MathUtils.degToRad(-93.5) * sitW;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += THREE.MathUtils.degToRad(-99.0) * sitW;
    if (b.leftFoot) b.leftFoot.rotation.x += THREE.MathUtils.degToRad(8.0) * sitW;
    if (b.rightFoot) b.rightFoot.rotation.x += THREE.MathUtils.degToRad(5.0) * sitW;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x += THREE.MathUtils.degToRad(-36 - 2 * breathe) * sitW;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += THREE.MathUtils.degToRad(-31 + 1.5 * idleShift) * sitW;
    if (b.leftUpperArm) b.leftUpperArm.rotation.z += THREE.MathUtils.degToRad(8) * sitW;
    if (b.rightUpperArm) b.rightUpperArm.rotation.z += THREE.MathUtils.degToRad(-7) * sitW;
    if (b.leftLowerArm) b.leftLowerArm.rotation.x += THREE.MathUtils.degToRad(35) * sitW;
    if (b.rightLowerArm) b.rightLowerArm.rotation.x += THREE.MathUtils.degToRad(31) * sitW;
    human.modelRoot.position.y -= 0.1 * cfg.unit * sitW;
    human.modelRoot.updateMatrixWorld(true);
    if (frame.seated || seatedBlend > 0.55) {
      poseFingers(human.leftFingers, 'idle', 1);
      poseFingers(human.rightFingers, 'grip', 0.7);
      return;
    }
  }

  if (frame.walkAmount * idle > 0.001) {
    const s = Math.sin(human.walkT * 5.15);
    const c = Math.cos(human.walkT * 5.15);
    const w = frame.walkAmount * idle;
    const liftL = Math.max(0, s);
    const liftR = Math.max(0, -s);
    const plantL = Math.max(0, -s);
    const plantR = Math.max(0, s);
    // Relaxed billiards-room walk: planted foot pressure, opposite arm swing,
    // hip rotation and shoulder counter-sway keep the avatar from sliding like a
    // mannequin while moving around the table perimeter.
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.x += (s * 0.32 - plantL * 0.035) * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.x += (-s * 0.32 - plantR * 0.035) * w;
    if (b.leftUpperLeg) b.leftUpperLeg.rotation.z += c * 0.035 * w;
    if (b.rightUpperLeg) b.rightUpperLeg.rotation.z += c * 0.035 * w;
    if (b.leftLowerLeg) b.leftLowerLeg.rotation.x += (liftR * 0.38 + plantL * 0.055) * w;
    if (b.rightLowerLeg) b.rightLowerLeg.rotation.x += (liftL * 0.38 + plantR * 0.055) * w;
    if (b.leftFoot) b.leftFoot.rotation.x += (liftR * 0.18 - plantL * 0.045) * w;
    if (b.rightFoot) b.rightFoot.rotation.x += (liftL * 0.18 - plantR * 0.045) * w;
    if (b.leftUpperArm) b.leftUpperArm.rotation.x += (-s * 0.27 - 0.025) * w;
    if (b.rightUpperArm) b.rightUpperArm.rotation.x += (s * 0.27 - 0.025) * w;
    if (b.leftLowerArm) b.leftLowerArm.rotation.x += (0.06 + liftL * 0.05) * w;
    if (b.rightLowerArm) b.rightLowerArm.rotation.x += (0.06 + liftR * 0.05) * w;
    if (b.spine) b.spine.rotation.z += c * 0.032 * w;
    if (b.chest) {
      b.chest.rotation.z -= c * 0.028 * w;
      b.chest.rotation.y += s * 0.026 * w;
    }
    if (b.hips) {
      b.hips.rotation.z -= c * 0.032 * w;
      b.hips.rotation.y -= s * 0.034 * w;
    }
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


function updateOriginalSkeletonHumanPose(human, dt, frameData) {
  const cfg = human.cfg;
  const state = frameData.state || 'idle';
  const activeState = state === 'rolling' || state === 'turnEnd' || state === 'gameOver' ? 'idle' : state;
  human.poolPlayerState = activeState === 'idle'
    ? 'ReturnToIdle'
    : activeState === 'dragging'
      ? 'AimAdjust'
      : activeState === 'striking'
        ? (human.strikeClock < cfg.strikeTime * 0.42 ? 'CuePullBack' : human.strikeClock < cfg.strikeTime ? 'CueStrike' : 'FollowThrough')
        : 'WatchBalls';
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
  const moveAmountRaw = (() => {
    dampVector(human.root.position, rootGoal, activeState === 'striking' ? 12 : cfg.moveLambda, dt);
    human.root.position.y = cfg.groundY;
    return human.root.position.distanceTo(rootGoal);
  })();
  human.walkT += dt * (2 + Math.min(7, (moveAmountRaw * 10) / cfg.unit));

  const tableAim = (frameData.cueTip || frameData.bridgeTarget || frameData.rootTarget)
    .clone()
    .sub(human.root.position)
    .setY(0);
  const visibleForward = tableAim.lengthSq() > 1e-8
    ? tableAim.normalize()
    : frameData.aimForward.clone().setY(0).normalize();
  const targetYaw = activeState === 'striking'
    ? human.strikeYaw
    : yawFromForward(visibleForward) - (cfg.humanVisualYawFix || 0);
  human.yaw = activeState === 'dragging' || activeState === 'striking'
    ? targetYaw
    : dampAngle(human.yaw, targetYaw, cfg.rotLambda, dt);

  const t = easeInOut(human.poseT);
  const idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * cfg.unit);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, (moveAmountRaw * 12) / cfg.unit);
  const walkAmount = clamp01((moveAmountRaw * 18) / cfg.unit) * idle;
  const dragStroke = activeState === 'dragging'
    ? Math.sin(performance.now() * 0.011) * (0.25 + (frameData.power || 0) * 0.75)
    : 0;
  const strikeFollow = activeState === 'striking'
    ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI)
    : 0;
  // Drive bend/stance from the visible direction: root -> cue/table.  This
  // prevents the ReadyPlayer visual-yaw correction from making the avatar fold
  // backward while the face points toward the shot.
  const visualYaw = human.yaw + (cfg.humanVisualYawFix || 0);
  const forward = visibleForward.clone();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, visualYaw).add(human.root.position);
  const powerLean = (frameData.power || 0) * t;
  const rootWorld = human.root.position.clone().addScaledVector(forward, (0.018 * powerLean + 0.026 * strikeFollow) * cfg.unit);
  rootWorld.y = cfg.groundY;
  const torso = local(new THREE.Vector3(0, lerp(1.3, 1.14, t) * cfg.unit + breath, (lerp(0.02, -0.16, t) - 0.014 * powerLean) * cfg.unit));
  const chest = local(new THREE.Vector3(0, lerp(1.52, 1.24, t) * cfg.unit + breath, (lerp(0.02, -0.42, t) - 0.024 * powerLean) * cfg.unit));
  const neck = local(new THREE.Vector3(0, lerp(1.68, 1.28, t) * cfg.unit + breath, (lerp(0.02, -0.61, t) - 0.028 * powerLean) * cfg.unit));
  const head = local(new THREE.Vector3(0, lerp(1.84, 1.37, t) * cfg.unit + breath - cfg.chinToCueHeight * 0.16 * t, (lerp(0.04, -0.72, t) - 0.028 * powerLean) * cfg.unit));
  const leftShoulder = local(new THREE.Vector3(-0.23 * cfg.unit, lerp(1.58, 1.36, t) * cfg.unit + breath, (lerp(0, -0.46, t) - 0.018 * human.settleT) * cfg.unit));
  const rightShoulder = local(new THREE.Vector3(0.23 * cfg.unit, lerp(1.58, 1.36, t) * cfg.unit + breath, (lerp(0, -0.34, t) - 0.018 * human.settleT) * cfg.unit));
  const leftHip = local(new THREE.Vector3(-0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const rightHip = local(new THREE.Vector3(0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const leftFoot = local(new THREE.Vector3(-0.13 * cfg.unit, cfg.footGroundY, 0.03 * cfg.unit + walk * 0.018 * cfg.unit).lerp(new THREE.Vector3(-cfg.stanceWidth * 0.42, cfg.footGroundY, -0.34 * cfg.unit), t));
  const rightFoot = local(new THREE.Vector3(0.13 * cfg.unit, cfg.footGroundY, -0.03 * cfg.unit - walk * 0.018 * cfg.unit).lerp(new THREE.Vector3(cfg.stanceWidth * 0.5, cfg.footGroundY, 0.34 * cfg.unit), t));
  const bridgePalmTarget = frameData.bridgeTarget.clone()
    .addScaledVector(forward, -0.006 * cfg.unit * t)
    .addScaledVector(side, -0.012 * cfg.unit * t)
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
  const idleWristTarget = frameData.idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, cfg.rightHandRollIdle, cfg.rightHandCueSocketLocal));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(cfg.rightHandRollIdle, cfg.rightHandRollShoot - cfg.rightHandDownPose, handIk), cfg.rightHandCueSocketLocal));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const leftElbow = leftShoulder.clone().lerp(leftHand, 0.62).addScaledVector(UP, 0.006 * cfg.unit * t).addScaledVector(side, -0.044 * cfg.unit * t).addScaledVector(forward, 0.065 * cfg.unit * t);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot, t)).addScaledVector(forward, 0.04 * cfg.unit * t).addScaledVector(side, -0.012 * cfg.unit * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot * 0.88, t)).addScaledVector(forward, -0.03 * cfg.unit * t).addScaledVector(side, 0.014 * cfg.unit * t);

  human.root.visible = true;
  human.lastMoveAmountRaw = moveAmountRaw;
  driveHuman(human, {
    t,
    dt,
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
    cueTipWorld: frameData.cueTip,
    seated: false,
    seatedBlend: 0,
    standTransition: 1
  });
  updateHumanDebugArrows(human, frameData, forward, cueDirForHand, cfg);
}

export function updateHumanPose(human, dt, frameData) {
  if (!human || !frameData || !Number.isFinite(dt) || dt < 0 || !frameData.rootTarget || !frameData.aimForward) return;
  if (human.cfg?.originalSkeletonLogic && (frameData.state || 'idle') !== 'seated') {
    updateOriginalSkeletonHumanPose(human, dt, frameData);
    return;
  }
  const cfg = human.cfg;
  const state = frameData.state || 'idle';
  const activeState = state === 'rolling' || state === 'turnEnd' || state === 'gameOver' ? 'idle' : state;
  const shotType = resolveShotType(frameData, cfg);
  const poseProfile = shotTypePoseProfile(shotType);
  human.lastShotType = shotType;
  const movingToShot = activeState !== 'seated' && activeState !== 'striking' && human.root.position.distanceTo(frameData.rootTarget) > 0.08 * cfg.unit;
  human.poolPlayerState = activeState === 'seated'
    ? 'IdleWaiting'
    : movingToShot
      ? 'WalkToShotPosition'
      : activeState === 'idle'
        ? 'ReturnToIdle'
        : activeState === 'dragging'
          ? 'AimAdjust'
          : activeState === 'striking'
            ? (human.strikeClock < cfg.strikeTime * 0.42 ? 'CuePullBack' : human.strikeClock < cfg.strikeTime ? 'CueStrike' : 'FollowThrough')
            : 'WatchBalls';
  human.poseT = dampScalar(human.poseT, activeState === 'idle' || activeState === 'seated' ? 0 : 1, cfg.poseLambda, dt);
  human.seatedBlend = dampScalar(human.seatedBlend || 0, activeState === 'seated' ? 1 : 0, activeState === 'seated' ? 7.5 : 3.2, dt);
  if (human.lastSeated && activeState !== 'seated') human.standTransitionT = 0;
  human.lastSeated = activeState === 'seated';
  human.standTransitionT = clamp01((human.standTransitionT ?? 1) + dt * 1.85);
  human.breathT += dt * (activeState === 'idle' || activeState === 'seated' ? 1.05 : 0.5);
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
  const standingUpFromChair = activeState !== 'seated' && (human.seatedBlend || 0) > 0.08;
  const directRootTarget = frameData.directRootTarget || activeState === 'seated' || standingUpFromChair;
  const moveAmountRaw = activeState === 'striking' || directRootTarget
    ? (() => {
        dampVector(human.root.position, rootGoal, standingUpFromChair ? cfg.moveLambda * 0.42 : directRootTarget ? cfg.moveLambda : 12, dt);
        human.root.position.y = cfg.groundY;
        return human.root.position.distanceTo(rootGoal);
      })()
    : moveRootAroundPerimeter(human, rootGoal, cfg, dt);
  const standGate = easeInOut(clamp01(human.standTransitionT ?? 1));
  human.walkT += dt * (1.45 + Math.min(5.2, (moveAmountRaw * 8.2) / cfg.unit)) * Math.max(0.35, standGate);
  const shootingPoseActive = activeState === 'dragging' || activeState === 'striking';
  const tableForward = resolveRootToTableForward(human.root.position, frameData);
  const facingForward = shootingPoseActive && tableForward
    ? tableForward
    : resolveTableFacingForward(frameData.aimForward, rootGoal, frameData, cfg);
  const targetRootYaw = yawFromForward(facingForward) - (cfg.humanVisualYawFix || 0);
  if (shootingPoseActive) {
    // Lock aiming/striking frames exactly onto the table-facing shot line. A slow
    // damp here can leave the avatar visibly aimed at the opposite rail for a few
    // frames after the cue camera drops.
    human.yaw = targetRootYaw;
  } else {
    human.yaw = dampAngle(human.yaw, targetRootYaw, cfg.rotLambda, dt);
  }
  ensureHumanFacingTable(human, frameData, cfg);

  const t = easeInOut(human.poseT);
  const idle = 1 - t;
  const breath = Math.sin(human.breathT * Math.PI * 2) * ((0.006 + idle * 0.004) * cfg.unit);
  const walk = Math.sin(human.walkT * 6.2) * Math.min(1, (moveAmountRaw * 12) / cfg.unit);
  human.lastMoveAmountRaw = moveAmountRaw;
  const walkAmount = clamp01((moveAmountRaw * 18) / cfg.unit) * idle * standGate;
  const dragStroke = activeState === 'dragging' ? Math.sin(performance.now() * 0.011) * (0.25 + (frameData.power || 0) * 0.75) : 0;
  const strikeFollow = activeState === 'striking' ? Math.sin(clamp01(human.strikeClock / (cfg.strikeTime + cfg.holdTime)) * Math.PI) : 0;
  const visualYaw = human.yaw + (cfg.humanVisualYawFix || 0);
  const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(Y_AXIS, visualYaw).normalize();
  const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
  const local = (v) => v.clone().applyAxisAngle(Y_AXIS, visualYaw).add(human.root.position);
  const powerLean = (frameData.power || 0) * t;
  const bendDirection = resolveShootBendSign(human, frameData, cfg);
  const counterLeanSide = cfg.shootCounterLeanSide >= 0 ? 1 : -1;
  const upperBodyCounterLean = Number.isFinite(cfg.shootUpperBodyCounterLean)
    ? Math.max(0, cfg.shootUpperBodyCounterLean)
    : 1;
  const forwardBendScale = Number.isFinite(cfg.shootForwardBendScale)
    ? Math.max(0, cfg.shootForwardBendScale)
    : 1;
  const plantFeetDuringShot = cfg.plantFeetDuringShot !== false;
  const shotBendZ = (value) => Math.abs(value) * bendDirection * forwardBendScale * poseProfile.lean;
  const shotCounterLeanX = (value) => (value + (poseProfile.hipSide || 0) * t) * counterLeanSide * upperBodyCounterLean;
  const rootWorld = human.root.position.clone();
  rootWorld.y = cfg.groundY;
  if (activeState === 'striking' && poseProfile.recoil) rootWorld.addScaledVector(forward, -poseProfile.recoil * cfg.unit * strikeFollow);

  // Real pool stance: feet/hips stay grounded and carry the weight; the fold is
  // from the belly upward, lowering the head toward the cue line without pushing
  // the entire body backward or off the floor.
  const torso = local(new THREE.Vector3(shotCounterLeanX(0.012 * t) * cfg.unit, lerp(1.3, 1.16, t) * cfg.unit + breath, shotBendZ(lerp(0.01, -0.12, t) - 0.008 * powerLean) * cfg.unit));
  const chest = local(new THREE.Vector3(shotCounterLeanX(0.038 * t + 0.006 * powerLean) * cfg.unit, lerp(1.52, 1.25, t) * cfg.unit + breath, shotBendZ(lerp(0.015, -0.36, t) - 0.014 * powerLean) * cfg.unit));
  const neck = local(new THREE.Vector3(shotCounterLeanX(0.055 * t + 0.008 * powerLean) * cfg.unit, lerp(1.68, 1.32, t) * cfg.unit + breath, shotBendZ(lerp(0.02, -0.52, t) - 0.016 * powerLean) * cfg.unit));
  const head = local(new THREE.Vector3(shotCounterLeanX(0.066 * t + 0.01 * powerLean) * cfg.unit, lerp(1.84, 1.39, t) * cfg.unit + breath - cfg.chinToCueHeight * 0.42 * t, shotBendZ(lerp(0.03, -0.62, t) - 0.018 * powerLean) * cfg.unit));
  const leftShoulder = local(new THREE.Vector3((-0.23 + shotCounterLeanX(0.048 * t)) * cfg.unit, lerp(1.58, 1.34, t) * cfg.unit + breath, shotBendZ(lerp(0, -0.43, t) - 0.012 * human.settleT) * cfg.unit));
  const rightShoulder = local(new THREE.Vector3((0.23 + shotCounterLeanX(0.034 * t)) * cfg.unit, lerp(1.58, 1.34, t) * cfg.unit + breath, shotBendZ(lerp(0, -0.36, t) - 0.012 * human.settleT) * cfg.unit));
  const leftHip = local(new THREE.Vector3(-0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const rightHip = local(new THREE.Vector3(0.13 * cfg.unit, 0.92 * cfg.unit, 0.02 * cfg.unit));
  const footWalkBlend = plantFeetDuringShot ? idle : 1;
  const stanceExtra = poseProfile.stanceWide * cfg.unit;
  const plantedLeftFootLocal = new THREE.Vector3(
    -cfg.stanceWidth * 0.56 - stanceExtra,
    cfg.footGroundY,
    (-0.41 - poseProfile.stanceBack) * cfg.unit
  );
  const plantedRightFootLocal = new THREE.Vector3(
    cfg.stanceWidth * 0.58 + stanceExtra,
    cfg.footGroundY,
    (0.39 + poseProfile.stanceBack * 0.72) * cfg.unit
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

  const bridgePalmSide = (cfg.bridgePoseUsesConfiguredSide
    ? cfg.bridgeHandSide
    : -0.012 * cfg.unit) + (poseProfile.bridgeSide || 0) * cfg.unit;
  const bridgePalmTarget = frameData.bridgeTarget.clone()
    .addScaledVector(forward, (-0.006 + poseProfile.bridgeReach) * cfg.unit * t)
    .addScaledVector(side, bridgePalmSide * t)
    .setY(cfg.tableTopY + cfg.bridgePalmTableLift + poseProfile.bridgeLift * cfg.unit)
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
  const pullBack = activeState === 'dragging' ? -(cfg.rightStrokePull + poseProfile.gripBack * cfg.unit) * easeOutCubic(frameData.power || 0) : 0;
  const pushForward = activeState === 'striking' ? cfg.rightStrokePush * poseProfile.followScale * strikeFollow : 0;
  const smallPractice = activeState === 'dragging' ? dragStroke * 0.035 * cfg.unit : 0;
  const forearmStroke = pullBack + pushForward + smallPractice;
  const forearmBase = lockedRightElbow.clone()
    .addScaledVector(side, cfg.rightForearmOutward * t)
    .addScaledVector(UP, -cfg.rightForearmDown * t)
    .addScaledVector(UP, cfg.rightHandShotLift * t)
    .addScaledVector(forward, -cfg.rightForearmBack * t)
    .addScaledVector(cueDirForHand, cfg.rightForearmLength);
  const liveCueGripPoint = forearmBase.clone()
    .addScaledVector(cueDirForHand, forearmStroke + poseProfile.gripBack * cfg.unit * t)
    .addScaledVector(UP, poseProfile.cueLift * cfg.unit * t);
  if (frameData.gripTarget) liveCueGripPoint.lerp(frameData.gripTarget, 0.72 * t);
  const idleWristTarget = frameData.idleRight.clone().sub(cueSocketOffsetWorld(idleGripSide, idleGripUp, cueDirForHand, cfg.rightHandRollIdle, cfg.rightHandCueSocketLocal));
  const liveWristTarget = liveCueGripPoint.clone().sub(cueSocketOffsetWorld(liveGripSide, liveGripUp, cueDirForHand, lerp(cfg.rightHandRollIdle, cfg.rightHandRollShoot - cfg.rightHandDownPose, handIk), cfg.rightHandCueSocketLocal));
  const rightHand = idleWristTarget.clone().lerp(liveWristTarget, t);
  const bridgeArmDownElbow = leftHand.clone()
    .addScaledVector(UP, 0.39 * cfg.unit)
    .addScaledVector(side, -0.01 * cfg.unit)
    .addScaledVector(forward, 0.012 * cfg.unit);
  const extendedBridgeElbow = leftShoulder.clone()
    .lerp(leftHand, 0.58)
    .addScaledVector(UP, -0.035 * cfg.unit * t)
    .addScaledVector(side, -0.028 * cfg.unit * t)
    .addScaledVector(forward, -0.055 * cfg.unit * t);
  const leftElbow = extendedBridgeElbow.lerp(bridgeArmDownElbow, cfg.bridgeArmStraightDown ? t : 0);
  const leftKnee = leftHip.clone().lerp(leftFoot, 0.53).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot, t)).addScaledVector(forward, 0.04 * cfg.unit * t).addScaledVector(side, -0.012 * cfg.unit * t);
  const rightKnee = rightHip.clone().lerp(rightFoot, 0.52).addScaledVector(UP, lerp(0.2 * cfg.unit, cfg.kneeBendShot * 1.02, t)).addScaledVector(forward, -0.03 * cfg.unit * t).addScaledVector(side, 0.014 * cfg.unit * t);

  human.root.visible = true;
  driveHuman(human, {
    t,
    dt,
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
    cueTipWorld: frameData.cueTip,
    seated: activeState === 'seated',
    seatedBlend: human.seatedBlend || 0,
    standTransition: standGate
  });
  updateHumanDebugArrows(human, frameData, forward, cueDirForHand, cfg);
}

function isBlockedStandingPoint(point, opts, cfg) {
  const tableW = opts.tableW ?? 2.0;
  const tableL = opts.tableL ?? 3.6;
  const clearance = Math.max(cfg.edgeMargin * 0.72, opts.bodyClearance ?? 0.34 * cfg.unit);
  if (Math.abs(point.x) < tableW / 2 + clearance && Math.abs(point.z) < tableL / 2 + clearance) return true;
  const blockers = Array.isArray(opts.blockers) ? opts.blockers : [];
  for (const blocker of blockers) {
    const center = blocker.center || blocker.position || blocker;
    const radius = Number(blocker.radius ?? blocker.clearance ?? 0);
    if (!center || !Number.isFinite(radius) || radius <= 0) continue;
    if (point.distanceToSquared(new THREE.Vector3(center.x, point.y, center.z)) <= radius * radius) return true;
  }
  if (typeof opts.isWalkable === 'function' && !opts.isWalkable(point.clone())) return true;
  return false;
}

export function chooseHumanEdgePosition(cueBallWorld, aimForward, opts = {}) {
  const cfg = scaleVectorConfig(opts);
  const shotDir = aimForward.clone().setY(0);
  if (shotDir.lengthSq() < 1e-8) shotDir.set(0, 0, -1);
  shotDir.normalize();
  const desired = cueBallWorld.clone().addScaledVector(shotDir, -cfg.desiredShootDistance);
  const tableW = opts.tableW ?? 2.0;
  const tableL = opts.tableL ?? 3.6;
  const xEdge = tableW / 2 + cfg.edgeMargin;
  const zEdge = tableL / 2 + cfg.edgeMargin;
  const groundY = cfg.groundY || 0;
  const behind = shotDir.clone().multiplyScalar(-1);
  const candidate = (x, z) => new THREE.Vector3(clamp(x, -xEdge, xEdge), groundY, clamp(z, -zEdge, zEdge));
  const candidates = [
    candidate(-xEdge, desired.z),
    candidate(xEdge, desired.z),
    candidate(desired.x, -zEdge),
    candidate(desired.x, zEdge),
    candidate(cueBallWorld.x + behind.x * cfg.desiredShootDistance, cueBallWorld.z + behind.z * cfg.desiredShootDistance),
    candidate(cueBallWorld.x + behind.x * (cfg.desiredShootDistance + cfg.edgeMargin * 0.5), cueBallWorld.z + behind.z * (cfg.desiredShootDistance + cfg.edgeMargin * 0.5))
  ];

  for (let i = -3; i <= 3; i += 1) {
    const lateral = i * cfg.edgeMargin * 0.42;
    candidates.push(candidate(desired.x + shotDir.z * lateral, desired.z - shotDir.x * lateral));
  }

  const unique = [];
  const seen = new Set();
  for (const point of candidates) {
    const key = `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(point);
    }
  }

  const score = (point) => {
    const cueToPoint = point.clone().sub(cueBallWorld).setY(0);
    const behindScore = cueToPoint.lengthSq() > 1e-8 ? Math.max(0, cueToPoint.normalize().dot(behind)) : 0;
    const sidePenalty = Math.abs(point.clone().sub(desired).dot(new THREE.Vector3(shotDir.z, 0, -shotDir.x)));
    const blockedPenalty = isBlockedStandingPoint(point, opts, cfg) ? 100000 : 0;
    const behindPenalty = (1 - behindScore) * cfg.desiredShootDistance * cfg.desiredShootDistance * 18;
    return blockedPenalty + behindPenalty + point.distanceToSquared(desired) + sidePenalty * 0.35;
  };

  const sorted = unique.sort((a, b) => score(a) - score(b));
  return (sorted[0] || desired).clone().setY(groundY);
}
