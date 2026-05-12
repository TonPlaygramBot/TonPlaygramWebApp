import * as THREE from "three";
import { TABLE_HALF_L, gameConfig } from "./gameConfig";

export class CameraController {
  private target = new THREE.Vector3(0, gameConfig.table.topY + 0.15, 0);
  update(camera: THREE.PerspectiveCamera, dt: number, ball: THREE.Vector3, aspect: number) {
    camera.fov = aspect < 0.72 ? gameConfig.camera.portraitFov : gameConfig.camera.landscapeFov;
    const nearBall = ball.z > TABLE_HALF_L - 0.25;
    const sideOffset = nearBall ? THREE.MathUtils.clamp(-ball.x * 0.32, -0.38, 0.38) : 0;
    const desired = new THREE.Vector3(sideOffset, aspect < 0.72 ? 5.75 : 4.9, aspect < 0.72 ? 6.95 : 6.05);
    camera.position.lerp(desired, 1 - Math.exp(-gameConfig.camera.damping * dt));
    this.target.lerp(new THREE.Vector3(ball.x * 0.12, gameConfig.table.topY + 0.12, -0.12), 1 - Math.exp(-gameConfig.camera.damping * dt));
    camera.lookAt(this.target);
    camera.updateProjectionMatrix();
  }
}
