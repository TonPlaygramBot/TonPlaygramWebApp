import * as THREE from "three";
import { TT } from "./gameConfig";

export class CameraController {
  private target = new THREE.Vector3(0, 1.55, -0.05);
  resize(camera: THREE.PerspectiveCamera, w: number, h: number) {
    camera.aspect = Math.max(0.1, w / Math.max(1, h));
    camera.fov = camera.aspect < 0.72 ? TT.camera.portraitFov : TT.camera.landscapeFov;
    camera.updateProjectionMatrix();
  }

  update(camera: THREE.PerspectiveCamera, ballPos: THREE.Vector3, playerPos: THREE.Vector3, dt: number) {
    const portrait = camera.aspect < 0.72;
    const sideOffset = portrait && ballPos.z > 1.1 ? THREE.MathUtils.clamp(ballPos.x - playerPos.x, -0.32, 0.32) : 0;
    const desired = new THREE.Vector3(sideOffset, portrait ? 5.9 : 5.0, portrait ? 7.0 : 6.1);
    const look = new THREE.Vector3(ballPos.x * 0.18, 1.55 + Math.max(0, ballPos.y - 1.55) * 0.22, -0.05 + ballPos.z * 0.08);
    const k = 1 - Math.exp(-TT.camera.damping * dt);
    camera.position.lerp(desired, k);
    this.target.lerp(look, k);
    camera.lookAt(this.target);
  }
}
