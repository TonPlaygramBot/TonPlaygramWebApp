import { createHumanRig, chooseHumanEdgePosition, updateHumanPose } from './humanRigCore';
import { driveHumanPoseWithRealisticHands } from './realisticCueHands';

export function createBilardoHumanRig(scene, opts = {}) {
  return createHumanRig(scene, {
    ...opts,
    cueHands: {
      bridgeStyle: 'open',
      gripStyle: 'relaxed',
      ...(opts.cueHands || {})
    }
  });
}

export { chooseHumanEdgePosition };

export function updateBilardoHumanPose(human, dt, frameData) {
  return driveHumanPoseWithRealisticHands(updateHumanPose, human, dt, frameData);
}
