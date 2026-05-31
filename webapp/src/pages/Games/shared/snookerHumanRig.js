import { createHumanRig, chooseHumanEdgePosition, updateHumanPose } from './humanRigCore';

export function createSnookerHumanRig(scene, opts = {}) {
  return createHumanRig(scene, opts);
}

export { chooseHumanEdgePosition };

export function updateBilardoHumanPose(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}
