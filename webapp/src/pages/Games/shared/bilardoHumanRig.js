import {
  createHumanPoolPlayer,
  chooseHumanEdgePosition,
  updateHumanPose,
  updateHumanMovement,
  updateCueGrip,
  updateBridgeHand,
  updateShotPose,
  updateIdlePose,
  updateWalkCycle
} from './HumanPoolPlayer.js';

export function createBilardoHumanRig(scene, opts = {}) {
  return createHumanPoolPlayer(scene, opts);
}

export { chooseHumanEdgePosition };

export function updateBilardoHumanPose(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export {
  updateHumanPose,
  updateHumanMovement,
  updateCueGrip,
  updateBridgeHand,
  updateShotPose,
  updateIdlePose,
  updateWalkCycle
};
