import * as THREE from "three";
import { gameConfig, PlayerSide } from "./gameConfig";

type CameraUpdateOptions = {
  incomingSide?: PlayerSide | null;
  predictedLanding?: THREE.Vector3 | null;
};

const tempIncomingTarget = new THREE.Vector3();
const tempBallBias = new THREE.Vector3();
const tempBaseTarget = new THREE.Vector3();
const tempLookTarget = new THREE.Vector3();
const tempFollowAnchor = new THREE.Vector3();
const tempOffset = new THREE.Vector3();

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
    options: CameraUpdateOptions = {}
  ) {
    const incomingToPlayer = options.incomingSide === "near";
    const targetDamping = 1 - Math.exp(-5.2 * dt);
    const zDamping = 1 - Math.exp(-4.3 * dt);
    const lateral = Math.max(-0.45, Math.min(0.45, ballPos.x * 0.08));

    if (preServe) {
      cameraPosTarget.copy(playerTarget).add(tempOffset.set(playerTarget.x * 0.08 + lateral, 10.7 * gameConfig.cameraViewScale, 17.9 * gameConfig.cameraViewScale));
      tempLookTarget.set(playerTarget.x * 0.2 + lateral, 1.95 * gameConfig.cameraViewScale, -gameConfig.courtL * 0.31);
      cameraTarget.lerp(tempLookTarget, targetDamping);
    } else {
      tempFollowAnchor.copy(playerTarget);
      tempBaseTarget.set(playerTarget.x + lateral, 1.95 * gameConfig.cameraViewScale, playerTarget.z - 11.7 * gameConfig.cameraViewScale);

      if (incomingToPlayer) {
        tempIncomingTarget.copy(options.predictedLanding || ballPos);
        tempIncomingTarget.x = THREE.MathUtils.clamp(tempIncomingTarget.x, -gameConfig.courtW / 2, gameConfig.courtW / 2);
        tempIncomingTarget.z = THREE.MathUtils.clamp(tempIncomingTarget.z, 0.25 * gameConfig.worldScale, gameConfig.courtL / 2);
        tempFollowAnchor.lerp(tempIncomingTarget, gameConfig.cameraPlayerFollowBlend);

        tempBallBias.copy(ballPos).lerp(tempIncomingTarget, 0.45);
        tempBallBias.y = Math.max(1.8 * gameConfig.cameraViewScale, ballPos.y * 0.34 + 1.72 * gameConfig.cameraViewScale);
        tempBaseTarget.lerp(tempBallBias, gameConfig.cameraBallLookAhead);
      }

      cameraPosTarget.copy(tempFollowAnchor).add(cameraOffset).add(tempOffset.set(lateral, 0, 0));
      cameraTarget.x += (tempBaseTarget.x - cameraTarget.x) * targetDamping;
      cameraTarget.y += (tempBaseTarget.y - cameraTarget.y) * targetDamping;
      cameraTarget.z += (tempBaseTarget.z - cameraTarget.z) * zDamping;
    }

    camera.position.lerp(cameraPosTarget, 1 - Math.exp(-gameConfig.cameraDamping * dt));
    camera.lookAt(cameraTarget);
  }
}
