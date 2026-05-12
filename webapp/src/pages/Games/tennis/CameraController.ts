import * as THREE from "three";
import { gameConfig } from "./gameConfig";
export class CameraController {
  constructor(private camera: THREE.PerspectiveCamera, private target: THREE.Vector3, private offset: THREE.Vector3, private cfg = gameConfig) {}
  update(player: THREE.Vector3, ball: THREE.Vector3, dt: number) {
    const sideOffset = THREE.MathUtils.clamp(ball.x * 0.16, -0.5, 0.5);
    const desired = player.clone().add(this.offset).add(new THREE.Vector3(sideOffset, 0, 0));
    this.camera.position.lerp(desired, 1 - Math.exp(-this.cfg.cameraDamping * dt));
    this.target.x += (player.x * 0.55 + ball.x * 0.2 - this.target.x) * (1 - Math.exp(-5.2 * dt));
    this.target.z += (player.z - 6.9 * this.cfg.worldScale - this.target.z) * (1 - Math.exp(-4.3 * dt));
    this.camera.lookAt(this.target);
  }
}
