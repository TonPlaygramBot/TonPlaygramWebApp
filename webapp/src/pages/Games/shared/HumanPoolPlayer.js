import {
  createHumanRig,
  chooseHumanEdgePosition,
  updateHumanPose as updateCoreHumanPose
} from './humanRigCore.js';

/**
 * Standalone human character facade for cue-sport players.
 *
 * This module intentionally contains no billiard physics, scoring, table rules,
 * shot validation, HUD, camera gameplay, or ball state. It preserves the existing
 * rig/IK/pose math by delegating to the known-good humanRigCore implementation
 * and exposes cue-sport-specific APIs for movement, cue grip, bridge hand,
 * shot stance, idle stance, walk cycle, and full-frame pose updates.
 */
export function createHumanPoolPlayer(scene, opts = {}) {
  return createHumanRig(scene, opts);
}

export { chooseHumanEdgePosition };

export function updateHumanPose(human, dt, frameData) {
  return updateCoreHumanPose(human, dt, frameData);
}

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
  return updateHumanPose(human, dt, frameData);
}

export function updateIdlePose(human, dt, frameData) {
  return updateHumanPose(human, dt, {
    ...frameData,
    state: 'idle'
  });
}

export function updateWalkCycle(human, dt, frameData) {
  return updateHumanPose(human, dt, frameData);
}

export const HumanCharacterController = Object.freeze({
  create: createHumanPoolPlayer,
  chooseHumanEdgePosition,
  updateHumanPose,
  updateHumanMovement,
  updateCueGrip,
  updateBridgeHand,
  updateShotPose,
  updateIdlePose,
  updateWalkCycle
});

export const HumanPoolPlayer = HumanCharacterController;
