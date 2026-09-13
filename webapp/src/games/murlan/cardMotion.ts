import * as THREE from 'three';
import {
  type CardContactRig, CARD_PICKUP_REACH_MS, CARD_CARRY_MS, CARD_RELEASE_MS,
  CARD_RECOVER_MS, smoothCardMotion, cardContactPoint, cardGripOffset,
  poseCardHand, pinCardToHand, restoreCardHand, applyCardGrip,
  captureCardHandPose, blendCardHandPose, applyCardHandPose, reachableCardPosition
} from './cardContact.ts';

type Transfer = {
  mesh: THREE.Object3D;
  from: THREE.Vector3;
  fromQuaternion: THREE.Quaternion;
  fromScale: THREE.Vector3;
  target: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
  targetScale: THREE.Vector3;
  releaseFrom?: THREE.Vector3;
  releaseQuaternion?: THREE.Quaternion;
};
export type CardPlayMotion = {
  mesh: THREE.Object3D;
  transfers: Transfer[];
  start: number;
  duration: number;
  pickupPose: THREE.Quaternion[];
  placement: THREE.Vector3;
  releasePose?: THREE.Quaternion[];
  returnPose?: THREE.Quaternion[];
};

export function beginCardPlay(rig: CardContactRig, meshes: THREE.Object3D[], cardHeight: number): CardPlayMotion | null {
  const transfers = meshes.flatMap((mesh) => {
    const animation = mesh.userData.animation;
    return animation?.precisionContact ? [{
      mesh, from: animation.from.clone(), fromQuaternion: animation.fromQuaternion.clone(),
      fromScale: (animation.fromScale || mesh.scale).clone(),
      target: animation.to.clone(), targetQuaternion: animation.toQuaternion.clone(),
      targetScale: (animation.toScale || mesh.scale).clone()
    }] : [];
  });
  if (!transfers.length) return null;
  const lead = transfers[0];
  const previousScale = lead.mesh.scale.clone();
  lead.mesh.scale.copy(lead.fromScale);
  const placement = reachableCardPosition(rig, lead.mesh, cardHeight, lead.target, lead.targetQuaternion);
  lead.mesh.scale.copy(previousScale);
  return {
    mesh: lead.mesh, transfers, placement,
    start: lead.mesh.userData.animation.start - CARD_PICKUP_REACH_MS,
    duration: CARD_CARRY_MS, pickupPose: captureCardHandPose(rig, 'right')
  };
}

function carry(rig: CardContactRig, play: CardPlayMotion, height: number, progress: number) {
  const lead = play.transfers[0];
  const travel = smoothCardMotion(progress);
  // Extract first; only then turn the wrist. Lower the card gently during the
  // final portion of the arm stroke instead of rotating it from the first frame.
  const turn = smoothCardMotion((progress - 0.16) / 0.70);
  const gather = smoothCardMotion(progress / 0.26);
  const mesh = lead.mesh;
  mesh.scale.copy(lead.fromScale);
  mesh.quaternion.slerpQuaternions(lead.fromQuaternion, lead.targetQuaternion, turn);
  mesh.position.lerpVectors(lead.from, play.placement, travel);
  mesh.position.y += Math.sin(Math.PI * travel) * height * lead.fromScale.y * 0.20;
  poseCardHand(rig, 'right', mesh, height, 1, 1);
  pinCardToHand(rig, 'right', mesh, height);
  const pinch = cardContactPoint(mesh, height);
  const initialLeadContact = cardGripOffset(height).multiply(lead.fromScale).applyQuaternion(lead.fromQuaternion).add(lead.from);
  play.transfers.forEach((transfer, index) => {
    if (index > 0) {
      transfer.mesh.scale.copy(transfer.fromScale);
      transfer.mesh.quaternion.slerpQuaternions(transfer.fromQuaternion, mesh.quaternion, gather);
      const relativeGrip = cardGripOffset(height).multiply(transfer.fromScale).applyQuaternion(transfer.fromQuaternion)
        .add(transfer.from).sub(initialLeadContact).multiplyScalar(1 - gather);
      const layer = new THREE.Vector3(0, 0, index * 0.0008 * gather).applyQuaternion(mesh.quaternion);
      const offset = cardGripOffset(height).multiply(transfer.mesh.scale).applyQuaternion(transfer.mesh.quaternion);
      transfer.mesh.position.copy(pinch).add(relativeGrip).add(layer).sub(offset);
    }
  });
}

export function stepCardPlay(rig: CardContactRig, play: CardPlayMotion, cardHeight: number, now: number) {
  const elapsed = Math.max(0, now - play.start);
  const releaseAt = CARD_PICKUP_REACH_MS + play.duration;
  if (elapsed < CARD_PICKUP_REACH_MS) {
    play.transfers.forEach(({mesh, from, fromQuaternion, fromScale}) => {
      mesh.position.copy(from); mesh.quaternion.copy(fromQuaternion); mesh.scale.copy(fromScale);
    });
    const progress = elapsed / CARD_PICKUP_REACH_MS;
    poseCardHand(rig, 'right', play.mesh, cardHeight, 1, smoothCardMotion((progress - 0.68) / 0.32));
    blendCardHandPose(rig, 'right', play.pickupPose, smoothCardMotion(progress / 0.84));
    return false;
  }
  if (elapsed < releaseAt) {
    carry(rig, play, cardHeight, (elapsed - CARD_PICKUP_REACH_MS) / play.duration);
    return false;
  }
  if (!play.releasePose) {
    // Sample the exact end pose once, independent of the display frame rate.
    carry(rig, play, cardHeight, 1);
    play.releasePose = captureCardHandPose(rig, 'right');
    play.transfers.forEach((transfer) => {
      transfer.releaseFrom = transfer.mesh.position.clone();
      transfer.releaseQuaternion = transfer.mesh.quaternion.clone();
    });
  }
  const releaseProgress = (elapsed - releaseAt) / CARD_RELEASE_MS;
  // Brief contact, then open the pinch and slide the cards across the felt.
  // Keep the arm at the release point instead of chasing the moving cards.
  const settle = smoothCardMotion((releaseProgress - 0.20) / 0.80);
  play.transfers.forEach((transfer) => {
    // Preserve physical dimensions in the hand. The existing table's larger
    // reading scale is applied only after the fingers have let go.
    transfer.mesh.scale.lerpVectors(transfer.fromScale, transfer.targetScale, settle);
    transfer.mesh.position.lerpVectors(transfer.releaseFrom!, transfer.target, settle);
    transfer.mesh.quaternion.slerpQuaternions(transfer.releaseQuaternion!, transfer.targetQuaternion, settle);
  });
  applyCardHandPose(rig, 'right', play.releasePose);
  applyCardGrip(rig, 'right', 1 - smoothCardMotion(releaseProgress / 0.48));
  if (releaseProgress < 1) return false;
  play.returnPose ??= captureCardHandPose(rig, 'right');
  restoreCardHand(rig, 'right');
  const recover = (elapsed - releaseAt - CARD_RELEASE_MS) / CARD_RECOVER_MS;
  blendCardHandPose(rig, 'right', play.returnPose, smoothCardMotion(recover));
  return recover >= 1;
}
