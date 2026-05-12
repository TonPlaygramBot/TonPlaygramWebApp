import * as THREE from "three";
import { TABLE_TENNIS_CONFIG as CFG, TABLE_HALF_L } from "./gameConfig";

export class CameraController {
  private readonly target = new THREE.Vector3(0, CFG.tableY + 0.1, -0.05);
  resize(camera: THREE.PerspectiveCamera, width: number, height: number) {
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.72 ? 48 : 42;
    camera.position.set(0, camera.aspect < 0.72 ? 5.9 : 5.0, camera.aspect < 0.72 ? 7.0 : 6.1);
    camera.lookAt(this.target);
    camera.updateProjectionMatrix();
  }
  update(camera: THREE.PerspectiveCamera, ballPos: THREE.Vector3, playerPos: THREE.Vector3, dt: number) {
    const nearBall = ballPos.z > TABLE_HALF_L - 0.55 && ballPos.distanceTo(playerPos) < 1.15;
    const xOffset = nearBall ? -Math.sign(ballPos.x || 1) * 0.28 : 0;
    const desired = new THREE.Vector3(xOffset, camera.aspect < 0.72 ? 5.9 : 5.0, camera.aspect < 0.72 ? 7.0 : 6.1);
    camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    this.target.lerp(new THREE.Vector3(ballPos.x * 0.08, CFG.tableY + 0.15, -0.05 + ballPos.z * 0.05), 1 - Math.exp(-4.4 * dt));
    camera.lookAt(this.target);
  }
}
