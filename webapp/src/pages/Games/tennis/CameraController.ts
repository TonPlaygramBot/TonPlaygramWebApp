import * as THREE from "three";
import { gameConfig, PlayerSide, sideOfZ } from "./gameConfig";

type CameraUpdateContext = {
  ballVel?: THREE.Vector3;
  predictedLanding?: THREE.Vector3;
  receiverSide?: PlayerSide;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export class CameraController {
  update(
    camera: THREE.PerspectiveCamera,
    cameraTarget: THREE.Vector3,
    cameraPosTarget: THREE.Vector3,
    playerTarget: THREE.Vector3,
    ballPos: THREE.Vector3,
    cameraOffset: THREE.Vector3,
    preServe: boolean,
    dt: number,
    context: CameraUpdateContext = {}
  ) {
    const ballVel = context.ballVel ?? new THREE.Vector3();
    const predictedLanding = context.predictedLanding ?? ballPos;
    const receiverSide = context.receiverSide ?? "near";
    const receiverSign = receiverSide === "near" ? 1 : -1;
    const incomingToReceiver = !preServe && (sideOfZ(ballPos.z) === receiverSide || sideOfZ(predictedLanding.z) === receiverSide) && ballVel.z * receiverSign > -0.45;
    const ballSpeed = ballVel.length();
    const rallyEnergy = clamp(ballSpeed / (10.5 * gameConfig.worldScale), 0, 1);
    const lateral = clamp((ballPos.x * 0.055 + predictedLanding.x * 0.035) * (0.65 + rallyEnergy * 0.35), -0.72 * gameConfig.worldScale, 0.72 * gameConfig.worldScale);

    if (preServe) {
      cameraPosTarget.copy(playerTarget).add(new THREE.Vector3(playerTarget.x * 0.08 + lateral * 0.35, 6.25 * gameConfig.cameraViewScale, 10.4 * gameConfig.cameraViewScale));
      cameraTarget.x += (playerTarget.x * 0.2 + lateral * 0.38 - cameraTarget.x) * smooth(5.2, dt);
      cameraTarget.y += ((1.12 + rallyEnergy * 0.12) * gameConfig.cameraViewScale - cameraTarget.y) * smooth(4.4, dt);
      cameraTarget.z += ((-gameConfig.courtL * 0.24) - cameraTarget.z) * smooth(5.1, dt);
    } else {
      const contactDepth = predictedLanding.clone();
      contactDepth.z += receiverSign * (incomingToReceiver ? 0.52 : 0.28) * gameConfig.worldScale;
      const landingLead = contactDepth.lerp(ballPos, incomingToReceiver ? 0.34 : 0.64);
      const receiverFocus = playerTarget.clone().lerp(landingLead, incomingToReceiver ? 0.7 : 0.42);
      receiverFocus.x += lateral;
      receiverFocus.y = (0.9 + rallyEnergy * 0.28) * gameConfig.cameraViewScale + clamp(ballPos.y * 0.18, 0, 0.72 * gameConfig.cameraViewScale);
      receiverFocus.z = clamp(
        receiverFocus.z - (incomingToReceiver ? 1.9 : 2.9) * gameConfig.cameraViewScale,
        -gameConfig.courtL * 0.42,
        gameConfig.courtL * 0.42
      );

      const dolly = 1 - rallyEnergy * 0.1 + (incomingToReceiver ? 0.075 : 0.045);
      const retreat = incomingToReceiver ? receiverSign * 0.46 * gameConfig.cameraViewScale : 0;
      cameraPosTarget.copy(playerTarget).addScaledVector(cameraOffset, dolly).add(new THREE.Vector3(lateral * 0.58, incomingToReceiver ? 0.36 * gameConfig.cameraViewScale : 0, retreat));
      cameraTarget.lerp(receiverFocus, smooth(incomingToReceiver ? 6.8 : 4.8, dt));
    }

    camera.position.lerp(cameraPosTarget, smooth(incomingToReceiver ? gameConfig.cameraDamping * 1.25 : gameConfig.cameraDamping, dt));
    camera.lookAt(cameraTarget);
  }
}
