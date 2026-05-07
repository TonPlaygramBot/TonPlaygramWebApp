import * as THREE from 'three';

const SKIN_MATERIALS = ['#d9a27d', '#c78f68', '#e0b18d', '#b87957', '#d39a72', '#c88b64'];

export const TEXAS_DOMINO_BATTLE_ROYAL_CHARACTER_THEMES = Object.freeze([
  { id: 'rpm-current-domino', shirt: '#55739a', pants: '#1f3f68', jacket: '#223044', shoes: '#171717', hair: '#24150f', eyes: '#2f5d7c', skin: '#d9a27d' },
  { id: 'rpm-67d411-domino', shirt: '#422534', pants: '#1d2433', jacket: '#7c2d12', shoes: '#211915', hair: '#14100c', eyes: '#5a3d2b', skin: '#c78f68' },
  { id: 'rpm-67f433-domino', shirt: '#d8c5a1', pants: '#334155', jacket: '#f8fafc', shoes: '#31251d', hair: '#2c1b12', eyes: '#406a45', skin: '#e0b18d' },
  { id: 'rpm-67e1b5-domino', shirt: '#151827', pants: '#111827', jacket: '#6d28d9', shoes: '#111111', hair: '#3a2418', eyes: '#364f7d', skin: '#b87957' },
  { id: 'webgl-vietnam-human-domino', shirt: '#cbd5e1', pants: '#4b5563', jacket: '#94a3b8', shoes: '#171717', hair: '#120d0a', eyes: '#33271e', skin: '#d39a72' },
  { id: 'webgl-ai-teacher-domino', shirt: '#7f1d1d', pants: '#1f2937', jacket: '#dc2626', shoes: '#171717', hair: '#231915', eyes: '#3d5f73', skin: '#c88b64' }
]);

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const ease01 = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function makeMat(color, roughness = 0.72, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness, metalness });
}

function makeCapsule(radius, length, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.001, length), segments, 16), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function placeCapsuleBetween(mesh, start, end) {
  if (!mesh || !start || !end) return;
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).addScaledVector(delta, 0.5);
  mesh.scale.y = length / Math.max(0.001, mesh.userData.baseLength ?? length);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
}

function setMeshColor(mesh, color) {
  const mat = mesh?.material;
  if (Array.isArray(mat)) mat.forEach((entry) => entry?.color?.set?.(color));
  else mat?.color?.set?.(color);
}

function createEyePair(theme) {
  const group = new THREE.Group();
  const eyeMat = makeMat(theme.eyes, 0.22, 0.01);
  [-0.032, 0.032].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), eyeMat);
    eye.position.set(x, 0.018, -0.105);
    group.add(eye);
  });
  return group;
}

export function createTexasHoldemSeatedHuman({ seat, seatIndex = 0, scale = 1 }) {
  const theme = TEXAS_DOMINO_BATTLE_ROYAL_CHARACTER_THEMES[seatIndex % TEXAS_DOMINO_BATTLE_ROYAL_CHARACTER_THEMES.length];
  const root = new THREE.Group();
  root.name = `texas-domino-battle-royal-seated-human-${seatIndex}`;

  const skin = makeMat(theme.skin ?? SKIN_MATERIALS[seatIndex % SKIN_MATERIALS.length]);
  const shirt = makeMat(theme.shirt);
  const pants = makeMat(theme.pants);
  const jacket = makeMat(theme.jacket);
  const shoes = makeMat(theme.shoes, 0.64, 0.04);
  const hair = makeMat(theme.hair, 0.76, 0.01);

  const torso = makeCapsule(0.18 * scale, 0.42 * scale, shirt);
  torso.name = 'dominoHumanTorso';
  torso.position.set(0, 0.83 * scale, 0.02 * scale);
  torso.rotation.x = THREE.MathUtils.degToRad(-8);
  torso.scale.x = 0.86;
  torso.scale.z = 0.72;
  root.add(torso);

  const jacketMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36 * scale, 0.34 * scale, 0.08 * scale), jacket);
  jacketMesh.name = 'dominoHumanOpenJacket';
  jacketMesh.position.set(0, 0.82 * scale, -0.045 * scale);
  jacketMesh.rotation.x = THREE.MathUtils.degToRad(-8);
  jacketMesh.castShadow = true;
  root.add(jacketMesh);

  const neck = makeCapsule(0.045 * scale, 0.045 * scale, skin);
  neck.position.set(0, 1.105 * scale, -0.035 * scale);
  root.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135 * scale, 22, 16), skin);
  head.name = 'dominoHumanHead';
  head.position.set(0, 1.235 * scale, -0.07 * scale);
  head.scale.set(0.9, 1.08, 0.82);
  head.castShadow = true;
  root.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.141 * scale, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hair);
  hairCap.name = 'dominoHumanHair';
  hairCap.position.set(0, 1.305 * scale, -0.067 * scale);
  hairCap.scale.set(0.96, 0.64, 0.88);
  hairCap.castShadow = true;
  root.add(hairCap);

  const eyes = createEyePair(theme);
  eyes.scale.setScalar(scale);
  eyes.position.copy(head.position);
  root.add(eyes);

  const limbs = {};
  const limbDefs = [
    ['leftUpperArm', 0.036, 0.28, jacket], ['rightUpperArm', 0.036, 0.28, jacket],
    ['leftForeArm', 0.032, 0.27, skin], ['rightForeArm', 0.032, 0.27, skin],
    ['leftThigh', 0.057, 0.42, pants], ['rightThigh', 0.057, 0.42, pants],
    ['leftCalf', 0.052, 0.38, pants], ['rightCalf', 0.052, 0.38, pants]
  ];
  limbDefs.forEach(([name, radius, length, material]) => {
    const mesh = makeCapsule(radius * scale, length * scale, material);
    mesh.name = `dominoHuman${name}`;
    mesh.userData.baseLength = length * scale;
    limbs[name] = mesh;
    root.add(mesh);
  });

  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 14, 10), skin);
  const rightHand = leftHand.clone();
  leftHand.name = 'dominoHumanLeftCardHand';
  rightHand.name = 'dominoHumanRightActionHand';
  [leftHand, rightHand].forEach((hand) => {
    hand.castShadow = true;
    root.add(hand);
  });

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.045 * scale, 0.2 * scale), shoes);
  const rightFoot = leftFoot.clone();
  leftFoot.name = 'dominoHumanLeftShoe';
  rightFoot.name = 'dominoHumanRightShoe';
  root.add(leftFoot, rightFoot);

  const fingerMat = skin.clone();
  const grippers = [leftHand, rightHand].map((hand, handIndex) => {
    const grip = new THREE.Group();
    grip.name = handIndex === 0 ? 'leftCardFingerGrips' : 'rightCardFingerGrips';
    [-0.018, 0.018].forEach((x) => {
      const finger = makeCapsule(0.006 * scale, 0.055 * scale, fingerMat, 6);
      finger.position.set(x, -0.008 * scale, -0.038 * scale);
      finger.rotation.x = THREE.MathUtils.degToRad(68);
      grip.add(finger);
    });
    hand.add(grip);
    return grip;
  });

  const human = {
    root,
    theme,
    limbs,
    hands: { left: leftHand, right: rightHand },
    grippers,
    action: { mode: 'idle', startedAt: 0, durationMs: 1 },
    setAction(mode, durationMs = 650) {
      this.action = { mode, startedAt: performance.now(), durationMs: Math.max(1, durationMs) };
    },
    update(nowMs = performance.now(), targetSeat = seat) {
      const tableCenter = new THREE.Vector3(0, targetSeat.seatPos?.y ?? 0, 0);
      const inward = targetSeat.forward.clone().normalize().negate();
      root.position.copy(targetSeat.seatPos).addScaledVector(targetSeat.forward, -0.22 * scale);
      root.position.y = (targetSeat.stoolHeight ?? targetSeat.seatPos.y ?? 0) - 0.12 * scale;
      root.lookAt(root.position.clone().add(inward));
      root.updateMatrixWorld(true);

      const elapsed = nowMs - (this.action.startedAt || 0);
      const progress = ease01(elapsed / (this.action.durationMs || 1));
      const live = elapsed <= (this.action.durationMs || 1);
      const mode = live ? this.action.mode : 'idle';
      const pulse = Math.sin(nowMs * 0.002 + seatIndex) * 0.012 * scale;

      const localTargets = {
        leftShoulder: new THREE.Vector3(-0.17 * scale, 1.04 * scale + pulse, -0.035 * scale),
        rightShoulder: new THREE.Vector3(0.17 * scale, 1.04 * scale + pulse, -0.035 * scale),
        leftHip: new THREE.Vector3(-0.105 * scale, 0.62 * scale, 0.035 * scale),
        rightHip: new THREE.Vector3(0.105 * scale, 0.62 * scale, 0.035 * scale),
        leftKnee: new THREE.Vector3(-0.15 * scale, 0.43 * scale, -0.31 * scale),
        rightKnee: new THREE.Vector3(0.15 * scale, 0.43 * scale, -0.31 * scale),
        leftFoot: new THREE.Vector3(-0.16 * scale, 0.17 * scale, -0.56 * scale),
        rightFoot: new THREE.Vector3(0.16 * scale, 0.17 * scale, -0.56 * scale)
      };

      const visibleCards = (targetSeat.cardMeshes ?? []).filter((mesh) => mesh?.visible);
      const cardCenterWorld = visibleCards.length
        ? visibleCards.reduce((sum, mesh) => sum.add(mesh.position), new THREE.Vector3()).multiplyScalar(1 / visibleCards.length)
        : (targetSeat.cardRailAnchor ?? targetSeat.cardAnchor ?? targetSeat.chipAnchor).clone();
      const cardCenter = root.worldToLocal(cardCenterWorld.clone());
      const cardRight = root.worldToLocal(cardCenterWorld.clone().add(targetSeat.right)).sub(cardCenter).normalize();
      const cardForward = root.worldToLocal(cardCenterWorld.clone().add(targetSeat.forward)).sub(cardCenter).normalize();
      const defaultLeftHand = cardCenter.clone().addScaledVector(cardRight, -0.16 * scale).addScaledVector(cardForward, -0.025 * scale).add(new THREE.Vector3(0, 0.045 * scale, 0));
      const defaultRightHand = cardCenter.clone().addScaledVector(cardRight, 0.16 * scale).addScaledVector(cardForward, -0.025 * scale).add(new THREE.Vector3(0, 0.045 * scale, 0));

      let leftTarget = defaultLeftHand;
      let rightTarget = defaultRightHand;
      if (mode === 'fold') {
        const throwWorld = (targetSeat.betAnchor ?? cardCenterWorld).clone().addScaledVector(targetSeat.forward, -0.2 * scale);
        const throwLocal = root.worldToLocal(throwWorld);
        rightTarget = defaultRightHand.clone().lerp(throwLocal, Math.sin(progress * Math.PI));
      } else if (mode === 'chip') {
        const chipStart = root.worldToLocal((targetSeat.chipRailAnchor ?? targetSeat.chipAnchor).clone());
        const chipEnd = root.worldToLocal((targetSeat.betAnchor ?? targetSeat.previewAnchor ?? targetSeat.chipAnchor).clone());
        const reach = progress < 0.5 ? ease01(progress / 0.5) : 1 - ease01((progress - 0.5) / 0.5) * 0.12;
        rightTarget = chipStart.clone().lerp(chipEnd, reach).add(new THREE.Vector3(0, 0.08 * Math.sin(progress * Math.PI) * scale, 0));
      }

      const leftElbow = localTargets.leftShoulder.clone().lerp(leftTarget, 0.48).add(new THREE.Vector3(-0.08 * scale, 0.025 * scale, 0.055 * scale));
      const rightElbow = localTargets.rightShoulder.clone().lerp(rightTarget, 0.48).add(new THREE.Vector3(0.08 * scale, 0.025 * scale, 0.055 * scale));
      placeCapsuleBetween(limbs.leftUpperArm, localTargets.leftShoulder, leftElbow);
      placeCapsuleBetween(limbs.leftForeArm, leftElbow, leftTarget);
      placeCapsuleBetween(limbs.rightUpperArm, localTargets.rightShoulder, rightElbow);
      placeCapsuleBetween(limbs.rightForeArm, rightElbow, rightTarget);
      leftHand.position.copy(leftTarget);
      rightHand.position.copy(rightTarget);

      placeCapsuleBetween(limbs.leftThigh, localTargets.leftHip, localTargets.leftKnee);
      placeCapsuleBetween(limbs.rightThigh, localTargets.rightHip, localTargets.rightKnee);
      placeCapsuleBetween(limbs.leftCalf, localTargets.leftKnee, localTargets.leftFoot);
      placeCapsuleBetween(limbs.rightCalf, localTargets.rightKnee, localTargets.rightFoot);
      leftFoot.position.copy(localTargets.leftFoot).add(new THREE.Vector3(0, -0.025 * scale, -0.045 * scale));
      rightFoot.position.copy(localTargets.rightFoot).add(new THREE.Vector3(0, -0.025 * scale, -0.045 * scale));
      leftFoot.rotation.x = rightFoot.rotation.x = THREE.MathUtils.degToRad(8);

      const gripClose = visibleCards.length ? 1 : 0.25;
      grippers.forEach((grip, idx) => {
        grip.rotation.x = THREE.MathUtils.lerp(0.5, -0.45, gripClose);
        grip.scale.z = THREE.MathUtils.lerp(1.15, 0.74, gripClose);
        grip.rotation.z = (idx === 0 ? -1 : 1) * 0.2 * gripClose;
      });
      setMeshColor(leftHand, theme.skin);
      setMeshColor(rightHand, theme.skin);
    },
    dispose() {
      root.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((mat) => mat?.dispose?.());
          else obj.material?.dispose?.();
        }
      });
      root.parent?.remove(root);
    }
  };

  human.update(performance.now(), seat);
  return human;
}

export function updateTexasHoldemSeatedHumans(seatGroups = [], nowMs = performance.now()) {
  seatGroups.forEach((seat) => {
    seat?.seatedHuman?.update?.(nowMs, seat);
  });
}
