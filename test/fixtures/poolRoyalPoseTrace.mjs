import { readFile } from 'node:fs/promises';
import * as THREE from '../../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from '../../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { CFG, chooseHumanEdgePosition, createReferenceHuman, cuePoseFromGrip } from '../../webapp/src/pages/Games/shared/poolRoyalReferenceHuman.ts';

export async function loadPoseModel() {
  const loader = new GLTFLoader();
  // Textures do not affect skeleton transforms. Skip browser-only image decoding.
  loader.register(() => ({ name: 'PoseTestTextures', loadTexture: () => Promise.resolve(null) }));
  const bytes = await readFile(new URL('../../webapp/public/assets/pool-royale/readyplayer.me.glb', import.meta.url));
  return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}

export function boneSnapshot(human) {
  human.modelRoot.updateMatrixWorld(true);
  const bones = {};
  human.modelRoot.traverse(bone => {
    if (bone.isBone) bones[bone.name] = [
      ...bone.getWorldPosition(new THREE.Vector3()).toArray(), ...bone.quaternion.toArray()
    ].map(value => +value.toFixed(8));
  });
  return { root: human.root.position.toArray(), yaw: human.yaw, bones };
}

export async function sampleReferenceTrace(drive) {
  const model = await loadPoseModel();
  const result = {};
  const realNow = performance.now;
  let time = 0;
  performance.now = () => time;
  try {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const human = createReferenceHuman(clone(model));
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      const ball = new THREE.Vector3(0, CFG.tableTopY + CFG.ballR, 0);
      const root = chooseHumanEdgePosition(ball, forward);
      human.root.position.copy(root);
      human.yaw = yaw;
      const side = new THREE.Vector3(forward.z, 0, -forward.x);
      const bridge = ball.clone().addScaledVector(forward, -CFG.bridgeHandBackFromBall)
        .addScaledVector(side, CFG.bridgeHandSide).setY(CFG.tableTopY + CFG.bridgePalmTableLift);
      const right = root.clone().add(new THREE.Vector3(CFG.idleRightHandX, CFG.idleRightHandY, CFG.idleRightHandZ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const left = root.clone().add(new THREE.Vector3(-0.18 * CFG.scale, 1.08 * CFG.scale, 0.03 * CFG.scale).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw));
      const idleCue = cuePoseFromGrip(right, CFG.idleCueDir.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw), CFG.idleCueGripFromBack);
      for (let index = 0; index < 148; index++) {
        time = index * (1000 / 60);
        const state = index < 20 || index >= 88 ? 'idle' : index < 80 ? 'dragging' : 'striking';
        const power = state === 'idle' ? 0 : 0.72;
        const tip = state === 'idle' ? idleCue.tip : ball.clone().addScaledVector(forward, -(CFG.ballR + CFG.idleGap + CFG.pullRange * power));
        const back = state === 'idle' ? idleCue.back : tip.clone().addScaledVector(forward, -CFG.cueLength);
        drive(human, 1 / 60, state, root, forward, bridge, right, left, back, tip, power);
        if ([19, 39, 79, 83, 87, 147].includes(index)) result[`${yaw}:${index}`] = boneSnapshot(human);
      }
    }
  } finally {
    performance.now = realNow;
  }
  return result;
}
