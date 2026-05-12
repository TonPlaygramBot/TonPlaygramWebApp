import * as THREE from "three";
import { CFG, TABLE_HALF_L } from "./gameConfig";

export class CameraController {
  private readonly target = new THREE.Vector3(0, CFG.tableY + 0.1, -0.05);

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.fov = this.camera.aspect < 0.72 ? 48 : 42;
    this.camera.updateProjectionMatrix();
  }

  update(ballPos: THREE.Vector3, playerPos: THREE.Vector3, dt: number) {
    const portrait = this.camera.aspect < 0.72;
    const ballNearPlayer = ballPos.z > TABLE_HALF_L * 0.52;
    const avoidBlockOffset = ballNearPlayer ? THREE.MathUtils.clamp((ballPos.x - playerPos.x) * 0.42, -0.38, 0.38) : 0;
    const desired = new THREE.Vector3(avoidBlockOffset, portrait ? 5.9 : 5.0, portrait ? 7.0 : 6.1);
    const look = new THREE.Vector3(ballPos.x * 0.1, CFG.tableY + 0.1 + Math.max(0, ballPos.y - CFG.tableY) * 0.12, -0.05);
    this.camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
    this.target.lerp(look, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.target);
  }
}
