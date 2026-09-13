import { createHumanRig, chooseHumanEdgePosition, updateHumanPose } from './humanRigCore';
import { driveHumanPoseWithRealisticHands } from './realisticCueHands';

export function createSnookerHumanRig(scene, opts = {}) {
  return createHumanRig(scene, {
    cueHands: {
      bridgeStyle: 'open',
      gripStyle: 'relaxed',
      ...(opts.cueHands || {})
    },
    ...opts
  });
}

export { chooseHumanEdgePosition };

export function updateBilardoHumanPose(human, dt, frameData) {
  return driveHumanPoseWithRealisticHands(updateHumanPose, human, dt, frameData);
}
