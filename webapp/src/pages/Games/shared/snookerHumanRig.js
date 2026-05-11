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

export function createSnookerHumanRig(scene, opts = {}) {
  return createHumanPoolPlayer(scene, opts);
}

export { chooseHumanEdgePosition };

export function updateSnookerHumanPose(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

// Backward-compatible alias for existing callers while Snooker migrates names.
export const updateBilardoHumanPose = updateSnookerHumanPose;

export {
  updateHumanPose,
  updateHumanMovement,
  updateCueGrip,
  updateBridgeHand,
  updateShotPose,
  updateIdlePose,
  updateWalkCycle
};
