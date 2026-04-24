import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js';

export const HUMAN_FSM = Object.freeze({
  LOADING: 'loading',
  IDLE: 'idle',
  WALK_TO_SHOT: 'walk_to_shot',
  ALIGN_STANCE: 'align_stance',
  FEATHER: 'feather',
  STRIKE: 'strike',
  RECOVER: 'recover'
});

const DEFAULTS = {
  avatarUrl: 'https://threejs.org/examples/models/gltf/readyplayer.me.glb',
  walkSpeed: 1.45,
  rotateSpeed: 8,
  stanceBackOffset: 0.74,
  stanceSideOffset: 0.2,
  shotHoldSeconds: 0.55,
  featherSeconds: 0.85,
  recoverSeconds: 0.45,
  hipHeight: 0.98,
  tableMargin: 0.45,
  bridgeDistance: 0.24,
  cueElevMaxDeg: 9
};

const BONE_HINTS = {
  hips: ['Hips', 'hip', 'mixamorigHips'],
  spine: ['Spine', 'Spine1', 'mixamorigSpine'],
  chest: ['Chest', 'Spine2', 'mixamorigSpine2'],
  neck: ['Neck', 'mixamorigNeck'],
  head: ['Head', 'mixamorigHead'],
  lShoulder: ['LeftShoulder', 'mixamorigLeftShoulder'],
  lUpperArm: ['LeftArm', 'mixamorigLeftArm'],
  lForeArm: ['LeftForeArm', 'mixamorigLeftForeArm'],
  lHand: ['LeftHand', 'mixamorigLeftHand'],
  rShoulder: ['RightShoulder', 'mixamorigRightShoulder'],
  rUpperArm: ['RightArm', 'mixamorigRightArm'],
  rForeArm: ['RightForeArm', 'mixamorigRightForeArm'],
  rHand: ['RightHand', 'mixamorigRightHand'],
  lIndex1: ['LeftHandIndex1', 'mixamorigLeftHandIndex1'],
  lIndex2: ['LeftHandIndex2', 'mixamorigLeftHandIndex2'],
  lThumb1: ['LeftHandThumb1', 'mixamorigLeftHandThumb1'],
  rIndex1: ['RightHandIndex1', 'mixamorigRightHandIndex1'],
  rMiddle1: ['RightHandMiddle1', 'mixamorigRightHandMiddle1'],
  rRing1: ['RightHandRing1', 'mixamorigRightHandRing1'],
  rPinky1: ['RightHandPinky1', 'mixamorigRightHandPinky1']
};

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function angleWrapRad(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function findBone(root, aliases) {
  for (const alias of aliases) {
    const bone = root.getObjectByName(alias);
    if (bone) return bone;
  }
  return null;
}

function buildBoneMap(root) {
  const bones = {};
  Object.entries(BONE_HINTS).forEach(([key, aliases]) => {
    bones[key] = findBone(root, aliases);
  });
  return bones;
}

function pickSkinnedMesh(root) {
  let found = null;
  root.traverse((obj) => {
    if (!found && obj.isSkinnedMesh) found = obj;
  });
  return found;
}

function computeStanceTarget(cueBallPos, shotDir, config) {
  const right = _v3a.set(shotDir.z, 0, -shotDir.x).normalize();
  return cueBallPos
    .clone()
    .addScaledVector(shotDir, -config.stanceBackOffset)
    .addScaledVector(right, config.stanceSideOffset);
}

function perimeterWaypoints(tableBounds, margin) {
  const minX = tableBounds.min.x - margin;
  const maxX = tableBounds.max.x + margin;
  const minZ = tableBounds.min.z - margin;
  const maxZ = tableBounds.max.z + margin;
  return [
    new THREE.Vector3(minX, 0, minZ),
    new THREE.Vector3(maxX, 0, minZ),
    new THREE.Vector3(maxX, 0, maxZ),
    new THREE.Vector3(minX, 0, maxZ)
  ];
}

function closestWaypointIndex(points, worldPos) {
  let best = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const d2 = points[i].distanceToSquared(worldPos);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

function buildPerimeterPath(points, fromPos, toPos) {
  const start = closestWaypointIndex(points, fromPos);
  const end = closestWaypointIndex(points, toPos);

  const forward = [];
  for (let i = start; i !== end; i = (i + 1) % points.length) {
    forward.push(points[i]);
  }
  forward.push(points[end]);

  const backward = [];
  for (let i = start; i !== end; i = (i - 1 + points.length) % points.length) {
    backward.push(points[i]);
  }
  backward.push(points[end]);

  const forwardLen = forward.reduce(
    (acc, p, i) => acc + (i ? p.distanceTo(forward[i - 1]) : 0),
    0
  );
  const backwardLen = backward.reduce(
    (acc, p, i) => acc + (i ? p.distanceTo(backward[i - 1]) : 0),
    0
  );

  const route = forwardLen <= backwardLen ? forward : backward;
  return [fromPos.clone(), ...route.map((p) => p.clone()), toPos.clone()];
}

export async function loadSnookerHuman({ scene, options = {} }) {
  const config = { ...DEFAULTS, ...options };
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(config.avatarUrl);
  const avatar = gltf.scene;
  avatar.name = 'SnookerHumanPlayer';
  avatar.position.set(0, 0, 0);
  avatar.scale.setScalar(1.08);

  avatar.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.filter(Boolean).forEach((mat) => {
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.needsUpdate = true;
    });
  });

  scene.add(avatar);

  const mixer = new THREE.AnimationMixer(avatar);
  const actions = new Map();
  for (const clip of gltf.animations || []) {
    actions.set(clip.name.toLowerCase(), mixer.clipAction(clip));
  }

  const skinnedMesh = pickSkinnedMesh(avatar);
  const ikSolver = skinnedMesh ? new CCDIKSolver(skinnedMesh, []) : null;

  return {
    avatar,
    mixer,
    actions,
    ikSolver,
    bones: buildBoneMap(avatar),
    config
  };
}

export function createSnookerHumanController({
  scene,
  tableBounds,
  cueBallRef,
  shotRef,
  options = {}
}) {
  const runtime = {
    scene,
    tableBounds,
    cueBallRef,
    shotRef,
    ...{
      human: null,
      state: HUMAN_FSM.LOADING,
      stateTime: 0,
      path: [],
      pathIndex: 0
    }
  };

  const config = { ...DEFAULTS, ...options };
  const perimeter = perimeterWaypoints(tableBounds, config.tableMargin);

  function changeState(next) {
    runtime.state = next;
    runtime.stateTime = 0;
  }

  function playBestAction(namePart) {
    if (!runtime.human) return;
    runtime.human.actions.forEach((a) => a.fadeOut(0.2));
    const hit = [...runtime.human.actions.entries()].find(([name]) =>
      name.includes(namePart)
    );
    if (!hit) return;
    const action = hit[1];
    action.reset().fadeIn(0.2).play();
  }

  function driveWalk(dt, targetPos) {
    const avatar = runtime.human.avatar;
    const toTarget = _v3a.copy(targetPos).sub(avatar.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    if (dist < 0.05) return true;

    const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
    const yaw = angleWrapRad(desiredYaw - avatar.rotation.y);
    avatar.rotation.y += clamp(
      yaw,
      -config.rotateSpeed * dt,
      config.rotateSpeed * dt
    );

    const step = Math.min(dist, config.walkSpeed * dt);
    toTarget.normalize();
    avatar.position.addScaledVector(toTarget, step);
    return false;
  }

  function solvePoseToShot(dt) {
    const { avatar, bones } = runtime.human;
    const shot = runtime.shotRef.current;
    const cueBall = runtime.cueBallRef.current;
    if (!shot || !cueBall) return;

    const cueBallPos = cueBall.position || cueBall;
    const shotDir = _v3a.copy(shot.direction).setY(0).normalize();
    const stancePos = computeStanceTarget(cueBallPos, shotDir, config);

    const lookYaw = Math.atan2(shotDir.x, shotDir.z);
    avatar.rotation.y +=
      angleWrapRad(lookYaw - avatar.rotation.y) * clamp(dt * 7, 0, 1);
    avatar.position.lerp(stancePos, clamp(dt * 4, 0, 1));

    if (bones.hips) bones.hips.position.y = config.hipHeight;

    const t = clamp(runtime.stateTime / config.featherSeconds, 0, 1);
    const feather = Math.sin(t * Math.PI * 6) * 0.012;

    if (bones.chest)
      bones.chest.rotation.x = THREE.MathUtils.lerp(
        bones.chest.rotation.x,
        -0.32,
        dt * 10
      );
    if (bones.neck)
      bones.neck.rotation.x = THREE.MathUtils.lerp(
        bones.neck.rotation.x,
        0.22,
        dt * 10
      );
    if (bones.head)
      bones.head.rotation.x = THREE.MathUtils.lerp(
        bones.head.rotation.x,
        0.08,
        dt * 10
      );

    // Front (bridge) arm: extended and stable for open bridge.
    if (bones.lUpperArm) bones.lUpperArm.rotation.set(-0.9, 0.25, 0.08);
    if (bones.lForeArm) bones.lForeArm.rotation.set(-0.15, 0.12, -0.2);
    if (bones.lHand) bones.lHand.rotation.set(-0.25, 0.1, 0.38);
    if (bones.lIndex1) bones.lIndex1.rotation.x = 0.18;
    if (bones.lIndex2) bones.lIndex2.rotation.x = 0.2;
    if (bones.lThumb1) bones.lThumb1.rotation.y = -0.4;

    // Rear (grip) arm: pendulum motion + relaxed fingers.
    if (bones.rUpperArm) bones.rUpperArm.rotation.set(-0.75, -0.22, -0.05);
    if (bones.rForeArm)
      bones.rForeArm.rotation.set(-0.45 + feather * 10, -0.1, 0.05);
    if (bones.rHand) bones.rHand.rotation.set(-0.08 + feather * 8, 0.03, -0.04);
    if (bones.rIndex1) bones.rIndex1.rotation.x = 0.55;
    if (bones.rMiddle1) bones.rMiddle1.rotation.x = 0.65;
    if (bones.rRing1) bones.rRing1.rotation.x = 0.7;
    if (bones.rPinky1) bones.rPinky1.rotation.x = 0.72;
  }

  function beginShotCycle() {
    const shot = runtime.shotRef.current;
    const cueBall = runtime.cueBallRef.current;
    if (!shot || !cueBall || !runtime.human) return;

    const cueBallPos = cueBall.position || cueBall;
    const shotDir = _v3a.copy(shot.direction).setY(0).normalize();
    const stancePos = computeStanceTarget(cueBallPos, shotDir, config);
    runtime.path = buildPerimeterPath(
      perimeter,
      runtime.human.avatar.position,
      stancePos
    );
    runtime.pathIndex = 1;

    playBestAction('walk');
    changeState(HUMAN_FSM.WALK_TO_SHOT);
  }

  function update(dt) {
    if (!runtime.human) return;
    runtime.stateTime += dt;
    runtime.human.mixer.update(dt);

    switch (runtime.state) {
      case HUMAN_FSM.IDLE:
        if (runtime.shotRef.current?.pendingHumanShot) beginShotCycle();
        break;
      case HUMAN_FSM.WALK_TO_SHOT: {
        const target = runtime.path[runtime.pathIndex];
        if (!target) {
          changeState(HUMAN_FSM.ALIGN_STANCE);
          playBestAction('idle');
          break;
        }
        const reached = driveWalk(dt, target);
        if (reached) runtime.pathIndex += 1;
        if (runtime.pathIndex >= runtime.path.length) {
          changeState(HUMAN_FSM.ALIGN_STANCE);
          playBestAction('idle');
        }
        break;
      }
      case HUMAN_FSM.ALIGN_STANCE:
        solvePoseToShot(dt);
        if (runtime.stateTime > config.shotHoldSeconds) {
          changeState(HUMAN_FSM.FEATHER);
        }
        break;
      case HUMAN_FSM.FEATHER:
        solvePoseToShot(dt);
        if (runtime.stateTime > config.featherSeconds) {
          changeState(HUMAN_FSM.STRIKE);
        }
        break;
      case HUMAN_FSM.STRIKE:
        solvePoseToShot(dt);
        if (runtime.stateTime > 0.08) {
          runtime.shotRef.current.executeHumanShot?.();
          changeState(HUMAN_FSM.RECOVER);
        }
        break;
      case HUMAN_FSM.RECOVER:
        if (runtime.stateTime > config.recoverSeconds) {
          runtime.shotRef.current.pendingHumanShot = false;
          changeState(HUMAN_FSM.IDLE);
          playBestAction('idle');
        }
        break;
      default:
        break;
    }

    runtime.human.ikSolver?.update();
  }

  async function init() {
    runtime.human = await loadSnookerHuman({ scene, options: config });
    playBestAction('idle');
    changeState(HUMAN_FSM.IDLE);
  }

  function dispose() {
    if (!runtime.human) return;
    runtime.human.mixer.stopAllAction();
    runtime.human.avatar.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.filter(Boolean).forEach((mat) => mat.dispose?.());
    });
    scene.remove(runtime.human.avatar);
    runtime.human = null;
  }

  return {
    init,
    update,
    dispose,
    triggerShot: beginShotCycle,
    getState: () => runtime.state,
    runtime
  };
}
