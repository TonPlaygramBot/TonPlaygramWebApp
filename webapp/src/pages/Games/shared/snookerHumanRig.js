import { createHumanPoolPlayer, chooseHumanEdgePosition, updateHumanPose } from './HumanPoolPlayer';

export function createSnookerHumanRig(scene, opts = {}) {
  return createHumanPoolPlayer(scene, opts);
}

export { chooseHumanEdgePosition };

export function updateBilardoHumanPose(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}
