import * as THREE from "three";
import { gameConfig } from "./gameConfig";

export class CameraController {
  update(camera: THREE.PerspectiveCamera, cameraTarget: THREE.Vector3, cameraPosTarget: THREE.Vector3, playerTarget: THREE.Vector3, ballPos: THREE.Vector3, cameraOffset: THREE.Vector3, preServe: boolean, dt: number) {
    const lateral = Math.max(-0.45, Math.min(0.45, ballPos.x * 0.08));
    if (preServe) {
      cameraPosTarget.copy(playerTarget).add(new THREE.Vector3(playerTarget.x * 0.08 + lateral, 6.25 * gameConfig.worldScale, 10.4 * gameConfig.worldScale));
      cameraTarget.x += (playerTarget.x * 0.2 + lateral - cameraTarget.x) * (1 - Math.exp(-5.2 * dt));
      cameraTarget.z += ((-gameConfig.courtL * 0.24) - cameraTarget.z) * (1 - Math.exp(-5.1 * dt));
    } else {
      cameraPosTarget.copy(playerTarget).add(cameraOffset).add(new THREE.Vector3(lateral, 0, 0));
      cameraTarget.x += (playerTarget.x + lateral - cameraTarget.x) * (1 - Math.exp(-5.2 * dt));
      cameraTarget.z += ((playerTarget.z - 6.9 * gameConfig.worldScale) - cameraTarget.z) * (1 - Math.exp(-4.3 * dt));
    }
    camera.position.lerp(cameraPosTarget, 1 - Math.exp(-gameConfig.cameraDamping * dt));
    camera.lookAt(cameraTarget);
  }
}
