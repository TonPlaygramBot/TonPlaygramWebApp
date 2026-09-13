import {
  createHumanRig,
  chooseHumanEdgePosition,
  updateHumanPose as driveStandaloneHumanPose
} from './humanRigCore';
import { driveHumanPoseWithRealisticHands } from './realisticCueHands';

/**
 * Standalone reusable human-character controller for cue-sports avatars.
 *
 * This module intentionally does not contain billiard physics, rules, scoring,
 * table logic, camera gameplay logic, HUD logic, shot validation, or ball state.
 * It keeps the existing body/stance/IK solver and adds a separate hand layer for
 * smoother wrists, relaxed cue grip, and realistic open/closed/rail bridge poses.
 */
export class HumanPoolPlayer {
  constructor(scene, opts = {}) {
    this.rig = createHumanPoolPlayer(scene, opts);
  }

  updateHumanPose(dt, frameData) {
    return updateHumanPose(this.rig, dt, frameData);
  }

  updateHumanMovement(dt, frameData) {
    return updateHumanMovement(this.rig, dt, frameData);
  }

  updateCueGrip(dt, frameData) {
    return updateCueGrip(this.rig, dt, frameData);
  }

  updateBridgeHand(dt, frameData) {
    return updateBridgeHand(this.rig, dt, frameData);
  }

  updateShotPose(dt, frameData) {
    return updateShotPose(this.rig, dt, frameData);
  }

  updateIdlePose(dt, frameData) {
    return updateIdlePose(this.rig, dt, frameData);
  }

  updateWalkCycle(dt, frameData) {
    return updateWalkCycle(this.rig, dt, frameData);
  }
}

export function createHumanPoolPlayer(scene, opts = {}) {
  return createHumanRig(scene, {
    cueHands: {
      bridgeStyle: 'open',
      gripStyle: 'relaxed',
      ...(opts.cueHands || {})
    },
    ...opts
  });
}

export function updateHumanPose(human, dt, frameData) {
  return driveHumanPoseWithRealisticHands(
    driveStandaloneHumanPose,
    human,
    dt,
    frameData
  );
}

// Public cue-sports human-character API. These functions intentionally remain
// separate so the game can drive only the subsystem it needs while every path
// still uses the same body IK + realistic hand refinement pipeline.
export function updateHumanMovement(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export function updateCueGrip(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export function updateBridgeHand(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export function updateShotPose(human, dt, frameData) {
  return updateHumanPose(human, dt, {
    ...frameData,
    state: frameData?.state || 'striking'
  });
}

export function updateIdlePose(human, dt, frameData) {
  return updateHumanPose(human, dt, {
    ...frameData,
    state: frameData?.state || 'idle'
  });
}

export function updateWalkCycle(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export { chooseHumanEdgePosition };
