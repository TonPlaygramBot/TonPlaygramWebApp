import { createHumanRig, chooseHumanEdgePosition, resolveHumanShotOrientation, updateHumanPose } from './humanRigCore';

export function createBilardoHumanRig(scene, opts = {}) {
  return createHumanRig(scene, opts);
}

export { chooseHumanEdgePosition, resolveHumanShotOrientation };

export function updateBilardoHumanPose(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}
