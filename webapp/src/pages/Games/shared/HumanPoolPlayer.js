import {
  createHumanRig,
  chooseHumanEdgePosition,
  updateHumanPose as driveStandaloneHumanPose
} from './humanRigCore';

/**
 * Standalone reusable human-character controller for cue-sports avatars.
 *
 * This module intentionally does not contain billiard physics, rules, scoring,
 * table logic, camera gameplay logic, HUD logic, shot validation, or ball state.
 * It is a thin API boundary around the existing proven human rig/IK/pose solver
 * so the visual behavior, quaternion math, hand placement, bridge hand, cue grip,
 * stance, walking, and follow-through remain byte-for-byte delegated to the
 * current implementation.
 */
export class HumanPoolPlayer {
  constructor(scene, opts = {}) {
    this.rig = createHumanRig(scene, opts);
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
  return createHumanRig(scene, opts);
}

export function updateHumanPose(human, dt, frameData) {
  return driveStandaloneHumanPose(human, dt, frameData);
}

// Public cue-sports human-character API. Each function deliberately delegates to
// the same solver entrypoint; splitting the API here isolates the human system
// without rewriting or reinterpreting the existing pose/IK math.
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
  return updateHumanPose(human, dt, { ...frameData, state: frameData?.state || 'striking' });
}

export function updateIdlePose(human, dt, frameData) {
  return updateHumanPose(human, dt, { ...frameData, state: frameData?.state || 'idle' });
}

export function updateWalkCycle(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export { chooseHumanEdgePosition };
